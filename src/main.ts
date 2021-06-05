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


import {join, relative }  from 'path';
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

  const { payload, eventName } = github.context;

  /**
   * Debug log the payload. */
  core.debug(`Payload keys: ${Object.keys(payload)}`)
  core.debug(`PullRequest keys: ${Object.keys(payload.pull_request || {})}`)

  /**
   * Get base and head values
   * depending on the event type. */
  let base, head;
  switch (eventName) {
    case 'push':
      base = payload.before;
      head = payload.after;
      break;

    case 'pull_request':
      base = payload.pull_request?.base.sha;
      head = payload.pull_request?.head.sha;
      break;
  }

  /**
   * Get changed files and reduce them to changed package paths. */
  const changedFiles    = await getFileChanges(token, base, head);
  const changedPackages = getChangedPackages(changedFiles, path);
  if (!!maxChanged && changedPackages.length > parseInt(maxChanged))
  {
    throw new Error('Number of changes exceeds maxChanges');
  }

  /**
   * Set the required output values */
  core.setOutput('matrix', JSON.stringify({ include: changedPackages }).replace(/"/g, '\\"'));
};

/**
 * Returns PR with all file changes
 *
 * @param  {string}   path
 * @param  {string[]} changes
 * @return {string[]}
 */
const getChangedPackages = (changes: string[], path: string) : Record<string, string>[] => {
  const include = core.getInput('include', { required: true });
  const exclude = core.getInput('exclude', { required: false });

  if (include !== '*')
  {
    /**
     * Filter based on include glob */
    changes = mm(changes, path + include);
  }

  if (exclude.length > 0)
  {
    /**
     * Filter out any matches that should be excluded
     * from being matched. */
    changes = changes.filter(m => !mm.isMatch(m, path + exclude));
  }

  const results = changes
    .map(change => {
      /**
       * Transform file path to be relative to the path specified
       * and take the first segment as the name. */
      const [ name ] = relative(path, change).split('/');
      return name;
    })
    .filter((e, i, s) => s.indexOf(e) === i)
    .map(p => ({ name: p, path: join(path, p) }));

  /**
   * Debug log the changed packages */
  core.debug('Changed packages:');
  results.forEach(({ name }) => core.debug(`  ${name}`));

  return results;
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
