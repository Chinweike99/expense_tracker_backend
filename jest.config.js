// /** @type {import('ts-jest').JestConfigWithTsJest} */
// const config = {
//   preset: 'ts-jest/presets/default-esm',
//   testEnvironment: 'node',
//   extensionsToTreatAsEsm: ['.ts'],
//   globals: {
//     'ts-jest': {
//       useESM: true,
//       tsconfig: 'tsconfig.json',
//     },
//   },
//   moduleFileExtensions: ['ts', 'js', 'json', 'node'],
//   transform: {
//     '^.+\\.ts$': ['ts-jest', { useESM: true }],
//   },
//   // If you have any path aliases, you can add moduleNameMapper here
//   // moduleNameMapper: {
//   //   '^@/(.*)$': '<rootDir>/src/$1',
//   // },
//   transformIgnorePatterns: ['node_modules/(?!(some-esm-package)/)'],
// };

// export default config;


/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
      '^(\\.{1,2}/.*)\\.js$': '$1', // Add this for ESM support
    },
    transform: {
      '^.+\\.ts$': [
        'ts-jest',
        {
          useESM: true,
          tsconfig: 'tsconfig.json',
          isolatedModules: true, // Add this for better performance
        },
      ],
    },
    transformIgnorePatterns: [
      // Update this to ignore all node_modules except your ESM packages
      'node_modules/(?!.*\\.mjs$|your-esm-packages)',
    ],
    // Add these for better test reporting
    verbose: true,
    testMatch: ['**/__tests__/**/*.test.ts'],
    // Setup for coverage if needed
    collectCoverage: false,
    coverageDirectory: 'coverage',
    coverageProvider: 'v8',
  };
  
  export default config;