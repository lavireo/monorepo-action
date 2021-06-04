/**
 * main.ts
 *
 * Author: Maurice T. Meyer
 * E-Mail: maurice@lavireo.com
 *
 * Copyright (c) 2021 Laviréo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


import { relative }  from 'path';
import * as mm       from 'micromatch';
import * as core     from '@actions/core';
import * as github   from '@actions/github';
import { FileEntry } from './types';

/**
 * Main functionality
 *
 * @return {Promise}
 */
const run = async () : Promise<void> => {
  /**
   * Make the input values accessible. */
  const path       = core.getInput('path', { required: false });
  const token      = core.getInput('token', { required: true });
  const maxChanged = core.getInput('max-changed', { required: false });

  let changes: string[] = [];
  const { payload, eventName } = github.context;

  /**
   * Debug log the payload. */
  core.debug(`Payload keys: ${Object.keys(payload)}`)
  core.debug(`PullRequest keys: ${Object.keys(payload.pull_request || {})}`)

  /**
   * Get base and head values
   * depending on the event type. */
  switch (eventName) {
    case 'push':
      changes = await getFileChanges(token, payload.before, payload.after);
      break;

    case 'pull_request':
      changes = await getFileChanges(token, payload.before, payload.after);
      break;
  }

  //const pullRequest = payload?.pull_request.;
  //if (!pullRequest?.number)
  //{
    /**
     * This may have been ran from something other
     * than a pull request. */
    //throw new Error('Could not get pull request number from context');
  //}

  /**
   * Get changed files and reduce them to changed package paths. */
  //const changes = await getFileChanges(token, pullRequest.number);
  const changed = getChanged(changes, path);

  /**
   * Check if we are over the max number of changes. */
  if (!!maxChanged && changed.length > parseInt(maxChanged))
  {
    throw new Error('Number of changes exceeds maxChanges');
  }

  /**
   * Set the required output values */
  const matrix = { include: [] }
  core.setOutput('matrix', matrix);
};

/**
 * Returns PR with all file changes
 *
 * @param  {string}   path
 * @param  {string[]} changes
 * @return {string[]}
 */
const getChanged = (changes: string[], path = '*') : string[] => {
  const include = core.getInput('include', { required: true });
  const exclude = core.getInput('exclude', { required: false });

  core.debug('Path: ' + path);
  core.debug('Including glob: ' + include);
  core.debug('Excluding glob: ' + exclude);
  core.debug('found changed files:');
  for (const file of changes)
  {
    core.debug('  ' + file);
  }

  core.debug('found matches');
  core.debug(path + include);
  let matches = mm(changes, path + include);
  if (exclude)
  {
    /**
     * Filter out any matches that should be excluded
     * from being matched. */
    matches = matches.filter(m => !mm.isMatch(m, path + exclude));
  }

  for (const match of matches)
  {
    core.debug('  ' + match);
  }

  const paths   = matches.map(m => relative(path, m));
  for (const match of paths)
  {
    core.debug('  ' + match);
  }

  return [];
}

/**
 * Returns PR with all file changes
 *
 * @param  {string} token
 * @param  {string} base
 * @param  {string} head
 * @return {Promise<string[]>}
 */
const getFileChanges = async (token: string, base: string, head: string) : Promise<string[]> => {
  /**
   * Create a new GitHub client
   * and pull some data from the action context. */
  const client          = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  const props    = { repo, owner, basehead: `${base}...${head}` };
  core.debug(`Basehead: ${base}...${head}`);
  const endpoint = client.rest.repos.compareCommitsWithBasehead.endpoint.merge(props);
  return client.paginate<any>(endpoint).then(
    ([ response ]) => {
      const { status, files } = response;
      if (status !== 'ahead')
      {
        /**
         * The response should always
         * be ahead of the base. */
        throw new Error('Basehead wrong way around');
      }

      return files.map((e: FileEntry) => e.filename);
    }
  );
}

/**
 * Run the GitHub action and call `setFailed`
 * in case an Error is thrown. */
run().catch(e => core.setFailed(e.message));
