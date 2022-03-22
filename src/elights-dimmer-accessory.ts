import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge'
import { setDimmerOutput } from './elights-api'

import { ElightsDynamicPlatform } from './platform'

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ElightsDimmerAccessory {
    private service: Service

    constructor(
        private readonly platform: ElightsDynamicPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        // set accessory information
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(
                this.platform.Characteristic.Manufacturer,
                'Mattias Holmlund',
            )
            .setCharacteristic(
                this.platform.Characteristic.Model,
                'DimmerOutput',
            )
            .setCharacteristic(
                this.platform.Characteristic.SerialNumber,
                accessory.UUID,
            )

        // get the LightBulb service if it exists, otherwise create a new LightBulb service
        // you can create multiple services for each accessory
        this.service =
            this.accessory.getService(this.platform.Service.Lightbulb) ||
            this.accessory.addService(this.platform.Service.Lightbulb)

        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.service.setCharacteristic(
            this.platform.Characteristic.Name,
            accessory.displayName,
        )

        // each service must implement at-minimum the "required characteristics" for the given service type
        // see https://developers.homebridge.io/#/service/Lightbulb

        // register handlers for the On/Off Characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below

        this.service
            .getCharacteristic(this.platform.Characteristic.Brightness)
            .onSet(this.setBrightness.bind(this))
    }

    /**
     * Handle "SET" requests from HomeKit
     * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
     */
    async setOn(value: CharacteristicValue) {
        this.platform.log.info(`${this.accessory.UUID} was set to: ${value}`)
        await setDimmerOutput(this.accessory.UUID, value ? 50 : 0)
    }

    async setBrightness(value: CharacteristicValue) {
        if (typeof value === 'number' && value >= 0 && value <= 100) {
            this.platform.log.info(
                `${this.accessory.UUID} was set to: ${value}`,
            )
            await setDimmerOutput(this.accessory.UUID, value)
        } else {
            this.platform.log.error(
                `${this.accessory.UUID} invalid value: ${value}`,
            )
        }
    }

    elightsValueUpdated(value: any) {
        if (typeof value === 'number') {
            const lightbulbService = this.accessory.getService(
                this.platform.Service.Lightbulb,
            )
            if (lightbulbService) {
                const char = lightbulbService.getCharacteristic(
                    this.platform.Characteristic.On,
                )
                char.updateValue(value > 0)
                const char2 = lightbulbService.getCharacteristic(
                    this.platform.Characteristic.Brightness,
                )
                char2.updateValue(value)
            } else {
                this.platform.log.error(
                    `No Lightbuld for Dimmer ${this.accessory.UUID}`,
                )
            }
        } else {
            this.platform.log.error(
                `Bad value ${value} for Dimmer ${this.accessory.UUID}`,
            )
        }
    }
}
