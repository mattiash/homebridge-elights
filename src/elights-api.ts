import got from  'got'

const BASE = 'http://elights-int.holmlund.se/api'

export interface ELIGHTS_COMPONENT_BASE {
    uuid: string
    room: string
    name: string
}

export interface ELIGHTS_DIMMER_OUTPUT extends ELIGHTS_COMPONENT_BASE {
    type: 'DimmerOutput'
    value: number
    percentage: number
}

export interface ELIGHTS_RELAY_OUTPUT extends ELIGHTS_COMPONENT_BASE {
    type: 'RelayOutput'
    value: boolean
}

export type ELIGHTS_COMPONENT = ELIGHTS_DIMMER_OUTPUT | ELIGHTS_RELAY_OUTPUT

export async function getComponents(): Promise<ELIGHTS_COMPONENT[]> {
    return await got( `${BASE}/uuid`).json()
}

export async function setRelayOutput(uuid: string, value: boolean) {
    await got.put( `${BASE}/uuid/${uuid}`, { json: { value } })
}

export async function setDimmerOutput(uuid: string, percentage: number) {
    await got.put( `${BASE}/uuid/${uuid}`, { json: { value: percentage } })
}