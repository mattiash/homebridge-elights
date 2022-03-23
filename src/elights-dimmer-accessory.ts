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

    // The value that the dimmer had when it was last on
    // or the current value if the dimmer is on
    private currentBrightness = 50
    private currentOn = true
    private currentElightsValue = 50

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
        this.platform.log.info(`setOn ${this.accessory.UUID} ${value}`)
        this.currentOn = !!value
        await this.updateElights()
    }

    async setBrightness(value: CharacteristicValue) {
        this.platform.log.info(`setBrightness ${this.accessory.UUID} ${value}`)
        if (typeof value === 'number' && value > 0 && value <= 100) {
            this.currentBrightness = value
            await this, this.updateElights()
        } else {
            this.platform.log.error(
                `${this.accessory.UUID} invalid value: ${value}`,
            )
        }
    }

    elightsValueUpdated(value: any) {
        this.platform.log.info(
            `elightsValueUpdated ${this.accessory.UUID} ${value}`,
        )
        if (typeof value === 'number' && value >= 0 && value <= 100) {
            this.currentElightsValue = value
            if (value === 0) {
                this.currentOn = false
            } else {
                this.currentOn = true
                this.currentBrightness = value
            }
            this.updateHomekit()
        } else {
            this.platform.log.error(
                `Bad value ${value} for Dimmer ${this.accessory.UUID}`,
            )
        }
    }

    private async updateElights() {
        this.platform.log.info(
            `updateElights ${this.accessory.UUID} ${this.currentOn} ${this.currentBrightness}`,
        )
        const newElightsValue = this.currentOn ? this.currentBrightness : 0
        if (newElightsValue !== this.currentElightsValue) {
            this.currentElightsValue = newElightsValue
            try {
                await setDimmerOutput(this.accessory.UUID, newElightsValue)
            } catch (err) {
                this.platform.log.error(`Failed to set dimmer in elights`)
            }
        } else {
            this.platform.log.info(
                `updateElights ${this.accessory.UUID} skipped`,
            )
        }
    }

    private updateHomekit() {
        this.platform.log.info(
            `updateHomekit ${this.accessory.UUID} ${this.currentOn} ${this.currentBrightness}`,
        )
        const lightbulbService = this.accessory.getService(
            this.platform.Service.Lightbulb,
        )
        if (lightbulbService) {
            const charOn = lightbulbService.getCharacteristic(
                this.platform.Characteristic.On,
            )
            if (charOn.value !== this.currentOn) {
                this.platform.log.info(
                    `On.value ${this.accessory.UUID} ${charOn.value} ${this.currentOn}`,
                )
                charOn.updateValue(this.currentOn)
            }
            const charBrightness = lightbulbService.getCharacteristic(
                this.platform.Characteristic.Brightness,
            )
            if (charBrightness.value !== this.currentBrightness) {
                this.platform.log.info(
                    `Brightness.value ${this.accessory.UUID} ${charBrightness.value} ${this.currentBrightness}`,
                )
                charBrightness.updateValue(this.currentBrightness)
            }
        } else {
            this.platform.log.error(
                `No Lightbulb for Dimmer ${this.accessory.UUID}`,
            )
        }
    }
}
