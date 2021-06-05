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
const path_1 = require("path");
const mm = require("micromatch");
const core = require("@actions/core");
const github = require("@actions/github");
/**
 * Main functionality
 *
 * @return {Promise}
 */
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    /**
     * Make the input values accessible. */
    const path = core.getInput('path', { required: false });
    const token = core.getInput('token', { required: true });
    const maxChanged = core.getInput('max-changed', { required: false });
    const { payload, eventName } = github.context;
    /**
     * Debug log the payload. */
    core.debug(`Payload keys: ${Object.keys(payload)}`);
    core.debug(`PullRequest keys: ${Object.keys(payload.pull_request || {})}`);
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
            base = (_a = payload.pull_request) === null || _a === void 0 ? void 0 : _a.base.sha;
            head = (_b = payload.pull_request) === null || _b === void 0 ? void 0 : _b.head.sha;
            break;
    }
    /**
     * Get changed files and reduce them to changed package paths. */
    const changedFiles = yield getFileChanges(token, base, head);
    const changedPackages = getChangedPackages(changedFiles, path);
    if (!!maxChanged && changedPackages.length > parseInt(maxChanged)) {
        throw new Error('Number of changes exceeds maxChanges');
    }
    /**
     * Set the required output values */
    core.setOutput('matrix', JSON.stringify({ include: changedPackages }).replace(/"/g, '\\"'));
});
/**
 * Returns PR with all file changes
 *
 * @param  {string}   path
 * @param  {string[]} changes
 * @return {string[]}
 */
const getChangedPackages = (changes, path) => {
    const include = core.getInput('include', { required: true });
    const exclude = core.getInput('exclude', { required: false });
    if (include !== '*') {
        /**
         * Filter based on include glob */
        changes = mm(changes, path + include);
    }
    if (exclude.length > 0) {
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
        const [name] = path_1.relative(path, change).split('/');
        return name;
    })
        .filter((e, i, s) => s.indexOf(e) === i)
        .map(p => ({ name: p, path: path_1.join(path, p) }));
    /**
     * Debug log the changed packages */
    core.debug('Changed packages:');
    results.forEach(({ name }) => core.debug(`  ${name}`));
    return results;
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
    const props = { repo, owner, basehead: `${base}...${head}` };
    core.debug(`Basehead: ${base}...${head}`);
    const endpoint = client.rest.repos.compareCommitsWithBasehead.endpoint.merge(props);
    return client.paginate(endpoint).then(([response]) => {
        const { status, files } = response;
        if (status !== 'ahead') {
            /**
             * The response should always
             * be ahead of the base. */
            throw new Error('Basehead wrong way around');
        }
        return files.map((e) => e.filename);
    });
});
/**
 * Run the GitHub action and call `setFailed`
 * in case an Error is thrown. */
run().catch(e => core.setFailed(e.message));
