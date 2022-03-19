import {test} from 'purple-tape'
import {getComponents} from '../elights-api'

test('getComponents', async (t) => {
    const components = await getComponents()

    t.gt(components.length, 100, 'shall return many components')
    t.deepEqual(components.filter( c => typeof c.name !== 'string' || c.name.length === 0),[], 'all components have a name' )
    t.deepEqual(components.filter( c => typeof c.room !== 'string' || c.room.length === 0),[], 'all components have a room' )
    t.deepEqual(components.filter( c => typeof c.type !== 'string' || c.type.length === 0),[], 'all components have a type' )
    t.deepEqual(components.filter( c => typeof c.uuid !== 'string' || c.uuid.length !== 36),[], 'all components have a uuid' )
})