/**
 * @since 2019-08-14 02:43
 * @author vivaxy
 */
const path = require('path');
const alfy = require('alfy');
const glob = require('fast-glob');

const PROJECT_CACHE_KEY = 'projects';

/**
 * wds should not end with slash `/`
 * e.g. /Users/vivaxy/Developer/*
 * @type {string}
 */
const wds = process.env.wds;

if (!wds) {
  throw new Error('Please config `wds`');
}

async function updateProjectsCache() {
  const parentFolders = wds.includes('*')
    ? await glob(wds, {
        cwd: '/',
        onlyDirectories: true,
      })
    : wds.split(',');

  const projects = (
    await Promise.all(
      parentFolders.map(async function (parentFolder) {
        const names = await glob('*', {
          cwd: parentFolder,
          onlyDirectories: true,
          dot: true,
        });
        return {
          names,
          parentFolder,
        };
      }),
    )
  ).reduce(function (all, { names, parentFolder }) {
    return [
      ...all,
      ...names.map(function (name) {
        return {
          name,
          parentFolder,
        };
      }),
    ];
  }, []);

  alfy.cache.set(PROJECT_CACHE_KEY, JSON.stringify(projects));
}

function getCachedProjects() {
  try {
    const outputCache = alfy.cache.get(PROJECT_CACHE_KEY);
    return JSON.parse(outputCache);
  } catch (e) {
    return [];
  }
}

const searchStrategies = {
  matchFromStart(value, input) {
    function format(v) {
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    return format(value).startsWith(format(input));
  },
  matchIncludes(value, input) {
    function format(v) {
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    return format(value).includes(format(input));
  },
  keywordIncludes(value, input) {
    const keywords = input
      .replace(/[^a-z0-9]/g, ' ')
      .split(' ')
      .filter(function (v) {
        return !!v;
      });
    return keywords.every((keyword) => {
      return searchStrategies.matchIncludes(value, keyword);
    });
  },
};

function search(projects, input) {
  if (input) {
    const searchResultsByStrategy = [];
    const searchStrategyNames = [
      'matchFromStart',
      'matchIncludes',
      'keywordIncludes',
    ];
    projects.forEach(function (project) {
      for (let i = 0; i < searchStrategyNames.length; i++) {
        const searchStrategy = searchStrategies[searchStrategyNames[i]];
        if (searchStrategy(project.name, alfy.input)) {
          searchResultsByStrategy[i] = searchResultsByStrategy[i] || [];
          searchResultsByStrategy[i].push(project);
          return;
        }
      }
    });
    return searchResultsByStrategy.reduce(function (all, searchResults) {
      return [...all, ...searchResults];
    }, []);
  }
  return projects;
}

function main() {
  const projects = getCachedProjects();
  const searchResults = search(projects, alfy.input);

  const output = searchResults.map(function ({ name, parentFolder, score }) {
    const absolutePath = path.join(parentFolder, name);
    return {
      title: name,
      uid: absolutePath,
      subtitle: absolutePath,
      arg: absolutePath,
      autocomplete: name,
      type: 'file',
    };
  });

  alfy.output(output, { rerunInterval: 1 });
  updateProjectsCache();
}

main();
