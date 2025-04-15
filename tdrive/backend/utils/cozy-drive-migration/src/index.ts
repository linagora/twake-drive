import 'dotenv/config'
import type { Channel, Connection, ConsumeMessage } from 'amqplib'
import amqp from 'amqplib'
import CozyClient from 'cozy-client'
import { downloadFile, executeCommand, migrateFile, migrateUser } from './utils'
import logger from './utils/logger'

const RABBITMQ_URL = process.env.RABBITMQ_URL
const QUEUE_NAME = process.env.QUEUE_NAME || ''
const BACKEND_URL = process.env.BACKEND_URL
const COZY_STACK = process.env.COZY_STACK

// eslint-disable-next-line ts/explicit-function-return-type
async function startListener() {
  try {
    // eslint-disable-next-line ts/ban-ts-comment
    // @ts-expect-error
    const connection: Connection = await amqp.connect(RABBITMQ_URL)
    // eslint-disable-next-line ts/ban-ts-comment
    // @ts-expect-error
    const channel: Channel = await connection.createChannel()

    await channel.assertQueue(QUEUE_NAME, { durable: true })
    await channel.prefetch(1)

    logger.info('Waiting for data...')

    channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
      if (msg !== null) {
        try {
          const message = JSON.parse(msg.content.toString()) as any

          logger.info(`Received action: ${message.action}`)

          if (message.action === 'user') {
            const user = message.data

            const command = `${COZY_STACK} instances add ${user.id}.localhost:8080 --passphrase cozy --apps home,store,drive,photos,settings,contacts,notes,passwords --email ${user.email} --locale en --public-name ${user.name} --context-name dev`

            try {
              const createUserResult = await executeCommand(command)

              logger.info('Command executed successfully:', createUserResult)

              const migrateUserResult = await migrateUser(user._id)
              if (migrateUserResult === 200) {
                logger.info('User migration completed successfully.')
              }
              else {
                logger.error('Error during user migration:', migrateUserResult)
              }
            }
            catch (error) {
              logger.error('Error executing command:', error)
            }
          }
          else if (message.action === 'file') {
            const actionPayload = message.data
            const commnad = `${COZY_STACK} instances token-cli ${actionPayload.userId}.localhost:8080 io.cozy.files`
            const userToken = await executeCommand(commnad)
            const client = new CozyClient({
              uri: `http://${actionPayload.userId}.localhost:8080`,
              token: userToken,
            })
            // download the file and buffer it
            for (const file of actionPayload.files) {
              try {
                let filePath = 'io.cozy.files.root-dir';
                if (file.path !== '') {
                  const sanitizedPath = file.path.replace(/^\//, '');
                  filePath = (await client.collection('io.cozy.files').createDirectoryByPath(sanitizedPath)).data.id;
                }
                const fileBuffer = await downloadFile(file.company_id, file._id);
                const fileUploadPayload = {
                  _type: 'io.cozy.files',
                  type: 'file',
                  dirId: filePath,
                  name: file.name,
                  data: fileBuffer,
                }
                await client.save(fileUploadPayload)
                logger.info(`✅ File created successfully: ${file.name}`)
                await migrateFile(file.company_id, file._id)
                logger.info(`✅ File migrated successfully: ${file.name}`)
              } catch (error) {
                logger.error(`ERROR CREATING THE FILE:: ${file.name}`)
                logger.error(`ERROR::  ${JSON.stringify(error)}`)
              }

            }
          }
          else {
            // eslint-disable-next-line no-console
            logger.info('Unknown action received:', message.action)
          }
        }
        catch (error) {
          logger.error('Error parsing message or processing.')
          logger.error('Error:', error)
        }
        finally {
          channel.ack(msg)
          // eslint-disable-next-line no-console
          logger.info(`Acknowledged message.`)
        }
      }
    })
  }
  catch (error) {
    logger.error('Error in listener:', error)
  }
}

startListener()
