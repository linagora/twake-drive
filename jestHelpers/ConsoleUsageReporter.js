/* eslint-disable class-methods-use-this */
const fs = require('fs')
const path = require('path')

const { red, reset } = require('chalk')

const TMP_FILE_PATH = path.join(process.cwd(), '.consoleUsageReporter.json')

/**
 * Prevents using the console in the tests without mocking it and prevents not
 * handling errors/warnings from 3rd parties.
 */
module.exports = class ConsoleUsageReporter {
  static deleteTemporaryFile() {
    try {
      fs.unlinkSync(TMP_FILE_PATH)
    } catch (e) {
      // Ignored
    }
  }

  static getTestFilesThatUsedConsole() {
    try {
      return JSON.parse(fs.readFileSync(TMP_FILE_PATH, 'utf8'))
    } catch (e) {
      return []
    }
  }

  static recordConsoleUsedInCurrentTestFile() {
    const { testPath } = global.jasmine
    const testFilesThatUsedConsole = this.getTestFilesThatUsedConsole()

    if (!testFilesThatUsedConsole.includes(testPath)) {
      testFilesThatUsedConsole.push(testPath)
      fs.writeFileSync(
        TMP_FILE_PATH,
        JSON.stringify(testFilesThatUsedConsole),
        'utf8'
      )
    }
  }

  static makeTestsFailWhenConsoleUsed() {
    let consoleCalls = []
    let testsRunning = true

    const formatConsoleCalls = calls =>
      calls
        .map(({ args, callStack, method }) => {
          const formattedArgs = args
            .map(arg => (arg instanceof Error ? arg.stack || arg : arg))
            .join(' ')
            .split('\n')
            .map(line => `  ${line}`)
            .join('\n')

          const formattedCallStack = !/^\s*(at|in) /m.test(formattedArgs)
            ? red(
                `\n\n${callStack
                  .split('\n')
                  .map(line => `  ${line}`)
                  .join('\n')}`
              )
            : ''

          return `console.${method}\n${reset(
            formattedArgs
          )}${formattedCallStack}`
        })
        .join('\n\n')
    ;['error', 'info', 'log', 'warn'].forEach(method => {
      global.console[method] = (...args) => {
        const callStack = new Error().stack
          .split('\n')
          .slice(2)
          .map(line => line.trim())
          .join('\n')

        if (consoleCalls.length === 0) {
          ConsoleUsageReporter.recordConsoleUsedInCurrentTestFile()
        }

        if (testsRunning) {
          consoleCalls.push({ args, callStack, method })
        } else {
          process.stderr.write(
            red(`
The console has been called outside a test which usually means you mishandled asynchronous actions.

Here is what have been logged:

${reset(formatConsoleCalls([{ args, callStack, method }]))}
`)
          )
        }
      }
    })

    beforeAll(() => {
      testsRunning = true
    })

    beforeEach(() => {
      consoleCalls = []
    })

    afterEach(() => {
      if (consoleCalls.length > 0) {
        throw new Error(
          red(`\
This test called the console which is forbidden.

Here is what have been logged:

${reset(formatConsoleCalls(consoleCalls))}

If calling the console is normal in your test case, consider mocking the \
console as is:

  jest.spyOn(console, 'method').mockImplementation();
`)
        )
      }
    })

    afterAll(() => {
      testsRunning = false
    })
  }

  constructor(globalConfig) {
    this.globalConfig = globalConfig
  }

  onRunComplete() {
    const isWatchModeEnabled =
      this.globalConfig.watch || this.globalConfig.watchAll
    const testFilesThatUsedConsole =
      ConsoleUsageReporter.getTestFilesThatUsedConsole()

    ConsoleUsageReporter.deleteTemporaryFile()

    if (testFilesThatUsedConsole.length > 0) {
      const error = new Error(
        red(
          `\
The following test files called the console which is forbidden:
${testFilesThatUsedConsole.map(file => `- ${file}`).join('\n')}

You should find more information in the report of the test that called the \
console.

We list all the test files there to allow you to find the console calls that \
did not make any test fail (possibly because of async issues).
`
        )
      )

      if (isWatchModeEnabled) {
        // Prevents to freeze watch mode
        console.error(error)
      } else {
        throw error
      }
    }
  }

  onRunStart() {
    ConsoleUsageReporter.deleteTemporaryFile()
  }
}
