import {
    API,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic,
    UnknownContext,
} from 'homebridge'

import http, { IncomingMessage, Server, ServerResponse } from 'http'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings'
import { ElightsRelayAccessory } from './elights-relay-accessory'
import { ELIGHTS_COMPONENT, getComponents } from './elights-api'
import { ElightsDimmerAccessory } from './elights-dimmer-accessory'

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ElightsDynamicPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service
    public readonly Characteristic: typeof Characteristic =
        this.api.hap.Characteristic

    // this is used to track restored cached accessories
    public readonly accessories = new Map<string, PlatformAccessory>()

    private readonly elightsComponents = new Map<
        string,
        ElightsRelayAccessory | ElightsDimmerAccessory
    >()
    private requestServer?: Server

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
        this.log.debug('Finished initializing platform:', this.config.name)

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback')
            // run the method to discover / register your devices as accessories
            void this.discoverDevices()
        })
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName)

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.set(accessory.UUID, accessory)
    }

    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices() {
        const components = await getComponents()

        for (const c of components) {
            if (c.type === 'RelayOutput' || c.type === 'DimmerOutput') {
                let existingAccessory = this.accessories.get(c.uuid)
                if (existingAccessory) {
                    this.log.info(`Restoring component ${c.uuid}`)
                    this.setupElightsComponent(c, existingAccessory)
                } else {
                    this.log.info(`Discovered component ${c.uuid}`)
                    const accessory = new this.api.platformAccessory(
                        `${c.room} ${c.name}`,
                        c.uuid,
                    )

                    this.setupElightsComponent(c, accessory)

                    // link the accessory to your platform
                    this.api.registerPlatformAccessories(
                        PLUGIN_NAME,
                        PLATFORM_NAME,
                        [accessory],
                    )
                }
                this.updateAccessoryValue(c.uuid, c.value)
            }
        }

        // The idea of this plugin is that we open a http service which exposes api calls to add or remove accessories
        this.createHttpService()
    }

    private setupElightsComponent(
        c: ELIGHTS_COMPONENT,
        accessory: PlatformAccessory<UnknownContext>,
    ) {
        if (c.type === 'RelayOutput') {
            this.elightsComponents.set(
                c.uuid,
                new ElightsRelayAccessory(this, accessory),
            )
        } else if (c.type === 'DimmerOutput') {
            this.elightsComponents.set(
                c.uuid,
                new ElightsDimmerAccessory(this, accessory),
            )
        }
    }

    private updateAccessoryValue(uuid: string, value: any) {
        const elightsComponent = this.elightsComponents.get(uuid)
        if (elightsComponent) {
            elightsComponent.elightsValueUpdated(value)
        } else {
            this.log.error(`updateAccessoryValue unknown uuid ${uuid}`)
        }
    }

    private createHttpService() {
        this.requestServer = http.createServer(this.handleRequest.bind(this))
        this.requestServer.listen(18081, () =>
            this.log.info('Http server listening on 18081...'),
        )
    }

    private handleRequest(request: IncomingMessage, response: ServerResponse) {
        {
            const m = request.url?.match(/\/uuid\/([0-9a-f-]+)\/(.*)/)
            if (m) {
                const uuid = m[1]
                const valueString = m[2]
                const value =
                    valueString === 'true'
                        ? true
                        : valueString === 'false'
                        ? false
                        : parseInt(valueString)
                this.updateAccessoryValue(uuid, value)
            }
        }

        {
            const m = request.url?.match(/\/removeAll/)
            if (m) {
                this.log.info('Removing all accessories')
                this.api.unregisterPlatformAccessories(
                    PLUGIN_NAME,
                    PLATFORM_NAME,
                    [...this.accessories.values()],
                )
                this.accessories.clear()
            }
        }

        response.writeHead(204) // 204 No content
        response.end()
    }
}
