module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: 'tsconfig.json',
		tsconfigRootDir: __dirname,
		sourceType: 'module',
	},
	plugins: ['@darraghor/nestjs-typed', '@typescript-eslint/eslint-plugin'],
	extends: [
		'plugin:@darraghor/nestjs-typed/recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:prettier/recommended',
	],
	root: true,
	env: {
		es6: true,
		node: true,
		jest: true,
	},
	ignorePatterns: ['.eslintrc.js'],
	rules: {
		'@typescript-eslint/interface-name-prefix': 'off',
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'prettier/prettier': [
			'error',
			{
				endOfLine: 'auto',
				printWidth: 120,
				trailingComma: 'es5',
				semi: true,
				doubleQuote: true,
				jsxSingleQuote: true,
				singleQuote: false,
				useTabs: true,
				tabWidth: 4,
			},
		],
	},
};
