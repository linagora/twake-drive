// Jest config dédiée au harness de test des cas de sélection (test-harness/).
// Séparée de jest.config.js (app, roots=src) pour ne pas mélanger code app et
// outillage de test. Lancer : node_modules/.bin/jest -c jest.harness.config.js
module.exports = {
  roots: ['<rootDir>/test-harness'],
  testEnvironment: 'node',
  testMatch: ['**/(*.)(spec|test).[jt]s?(x)'],
  clearMocks: true,
  transform: {
    '\\.(js|jsx|mjs)$': [
      '@swc/jest',
      {
        jsc: {
          experimental: { plugins: [['@swc-contrib/mut-cjs-exports', {}]] },
          parser: { jsx: true }
        }
      }
    ]
  }
}
