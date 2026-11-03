import { buildOrgInstance, ORG_ID, USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { publish } from '../helpers/rabbitmq'
import { findGroupByName } from '../helpers/stack'

// Checks the runtime the organization specs rely on: RabbitMQ reaches the
// stack, the organization instance is recognized, and the directory is
// centralized there.
test('A directory group published on RabbitMQ lands on the organization instance only', async () => {
  const name = `Directory ${stamp()}`
  publish('b2b', 'b2b.group.created', {
    organizationId: ORG_ID,
    id: name,
    name,
    members: [
      {
        email: USERS.dave.email,
        firstName: 'Dave',
        workplaceFqdn: USERS.dave.instance
      }
    ]
  })

  await expect
    .poll(() => findGroupByName(buildOrgInstance(), name), { timeout: 30_000 })
    .not.toBeNull()
  // A replicated directory would also copy it to its members
  expect(await findGroupByName(USERS.dave.instance, name)).toBeNull()
})
