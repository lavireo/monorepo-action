"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github = require("@actions/github");
/**
 * Main functionality
 *
 * @return {Promise}
 */
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    /**
     * Make the input values accessible. */
    const path = core.getInput('path', { required: false });
    const token = core.getInput('token', { required: true });
    const maxChanged = core.getInput('max-changed', { required: false });
    let changes = [];
    const { payload, eventName } = github.context;
    /**
     * Debug log the payload. */
    core.debug(`Payload keys: ${Object.keys(payload)}`);
    core.debug(`PullRequest keys: ${Object.keys(payload.pull_request || {})}`);
    /**
     * Get base and head values
     * depending on the event type. */
    switch (eventName) {
        case 'push':
            changes = yield getFileChanges(token, payload.before, payload.after);
            break;
        case 'pull_request':
            changes = yield getFileChanges(token, payload.before, payload.after);
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
    if (!!maxChanged && changed.length > parseInt(maxChanged)) {
        throw new Error('Number of changes exceeds maxChanges');
    }
    /**
     * Set the required output values */
    const matrix = { include: [] };
    core.setOutput('matrix', matrix);
});
/**
 * Returns PR with all file changes
 *
 * @param  {string}   path
 * @param  {string[]} changes
 * @return {string[]}
 */
const getChanged = (changes, path = '/') => {
    const include = core.getInput('include', { required: true });
    const exclude = core.getInput('exclude', { required: false });
    core.debug('Path: ' + path);
    core.debug('Including glob: ' + include);
    core.debug('Excluding glob: ' + exclude);
    core.debug('found changed files:');
    for (const file of changes) {
        core.debug('  ' + file);
    }
    return [];
};
/**
 * Returns PR with all file changes
 *
 * @param  {string} token
 * @param  {string} base
 * @param  {string} head
 * @return {Promise<string[]>}
 */
const getFileChanges = (token, base, head) => __awaiter(void 0, void 0, void 0, function* () {
    /**
     * Create a new GitHub client
     * and pull some data from the action context. */
    const client = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const props = { repo, owner, basehead: `${base}...${head};` };
    const endpoint = client.rest.repos.compareCommitsWithBasehead.endpoint.merge(props);
    return client.paginate(endpoint).then((response) => {
        const { status, files } = response.data;
        core.debug(`Response keys: ${Object.keys(response)}`);
        core.debug(`Status: ${status}`);
        return files.map((e) => {
            core.debug(`File keys: ${Object.keys(e)}`);
            return e.filename;
        });
    });
});
/**
 * Run the GitHub action and call `setFailed`
 * in case an Error is thrown. */
run().catch(e => core.setFailed(e.message));
