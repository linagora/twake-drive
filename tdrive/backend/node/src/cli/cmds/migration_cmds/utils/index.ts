import amqp from "amqplib";

const RABBITMQ_URL = "amqp://localhost";
const QUEUE_NAME = "demo_queue";

export async function publishMessage(message: { [key: string]: any }) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), { persistent: true });

    console.log(`✅ (1)Message sent: ${JSON.stringify(message)}`);

    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error("❌ Error in publisher:", error);
  }
}
