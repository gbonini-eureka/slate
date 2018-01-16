const fs = require('fs-extra');
const path = require('path');
const execa = require('execa');
const createSlateTheme = require('../createSlateTheme');
const config = require('../config');

const TEST_PROJECT = 'test-project';
const TEST_STARTER = 'test-repo';
const TEST_COMMITTISH = '123456';
const CLONE_COMMAND = `git clone
  git@github.com:shopify/${TEST_STARTER}.git
  ${path.resolve(TEST_PROJECT)}
  --single-branch`;
const CLONE_BRANCH_COMMAND = `git clone
  -b ${TEST_COMMITTISH}
  git@github.com:shopify/${TEST_STARTER}.git
  ${path.resolve(TEST_PROJECT)}
  --single-branch`;

beforeAll(() => {
  // Mock process.exit since it terminates the test runner
  process.exit = jest.fn(code => {
    throw new Error(`Process exit with code: ${code}`);
  });
});

beforeEach(() => {
  fs.__resetMockFiles();
  execa().mockClear();
});

test('can clone a theme from a Github repo', async () => {
  const [file, ...args] = CLONE_COMMAND.split(/\s+/);

  await createSlateTheme('test-project', 'shopify/test-repo');

  expect(fs.existsSync('test-project/package.json')).toBeTruthy();
  expect(execa()).toHaveBeenCalledWith(file, args, {stdio: 'pipe'});
});

test('can clone a theme from a Github repo with a specified commitish (branch)', async () => {
  const [file, ...args] = CLONE_BRANCH_COMMAND.split(/\s+/);

  await createSlateTheme('test-project', 'shopify/test-repo#123456');

  expect(fs.existsSync('test-project/package.json')).toBeTruthy();
  expect(execa()).toHaveBeenCalledWith(file, args, {stdio: 'pipe'});
});

test('can copy a theme from a local directory', async () => {
  fs.__addMockFiles({
    'old-project/package.json': '{ "name": "test-repo" }',
    'old-project/node_modules/some-package/index.js': '',
    'old-project/.git/index': '',
  });

  await createSlateTheme('test-project', 'old-project');
  expect(fs.existsSync('test-project/package.json')).toBeTruthy();
  expect(
    fs.existsSync('test-project/node_modules/some-package/index.js')
  ).toBeFalsy();
  expect(fs.existsSync('test-project/.git/index')).toBeFalsy();
});

test('installs theme dependencies after cloning or copying', async () => {
  await createSlateTheme('test-project', 'shopify/test-repo');
  expect(execa()).toHaveBeenCalledWith('yarnpkg', [], {stdio: 'inherit'});
});

test('copys shopify.yml to the config directory', async () => {
  await createSlateTheme('test-project', 'shopify/test-repo');
  expect(() => {
    jest.requireActual('fs-extra').existsSync(config.shopifyConfig.src);
  }).toBeTruthy();
  expect(fs.existsSync('test-project/config/shopify.yml')).toBeTruthy();
});

test('can skip installing theme dependencies', async () => {
  await createSlateTheme(
    'test-project',
    'shopify/test-repo',
    Object.assign({}, config.defaultOptions, {skipInstall: true})
  );
  expect(execa()).not.toHaveBeenCalledWith('yarnpkg', [], {stdio: 'inherit'});
  expect(execa()).not.toHaveBeenCalledWith('npm', ['install'], {
    stdio: 'inherit',
  });
});

test('fails if theme name does not adhere to NPM naming restrictions', () => {
  expect(() => {
    createSlateTheme('test project', config.defaultStarter);
  }).toThrow();
  expect(process.exit).toHaveBeenCalled();
});

test('fails if the a conflicting file already exists in the theme directory', () => {
  require('fs-extra').__addMockFiles({
    'test-project/package.json': '{ "name": "test-repo" }',
  });

  expect(() => {
    createSlateTheme('test-project', config.defaultStarter);
  }).toThrow();
  expect(process.exit).toHaveBeenCalled();
});

test('throws an error when copying from a local directory that does not exist', async () => {
  await expect(() => {
    return createSlateTheme('test-project', 'old-project');
  }).toThrow();
});

test('throws an error if a project already exists', async () => {
  fs.__addMockFiles({
    'test-project/package.json': '{ "name": "test-repo" }',
  });

  expect(() => {
    return createSlateTheme('test-project', 'shopify/test-repo');
  }).toThrow();
});