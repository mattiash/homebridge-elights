import http, {IncomingMessage, Server, ServerResponse} from "http";
import {
  API,
  APIEvent,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig,
} from "homebridge";
import { getComponents, setRelayOutput } from "./elights-api";

const PLUGIN_NAME = "homebridge-elights";
const PLATFORM_NAME = "Elights";

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;
let Accessory: typeof PlatformAccessory;

export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLATFORM_NAME, ElightsDynamicPlatform);
};

class ElightsDynamicPlatform implements DynamicPlatformPlugin {
  private requestServer?: Server;

  private readonly accessories = new Map<string, PlatformAccessory>();

  constructor(private readonly log: Logging, config: PlatformConfig, private readonly api: API) {

    // probably parse config or something here

    log.info("Elights platform finished initializing!");

    /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
    api.on(APIEvent.DID_FINISH_LAUNCHING, async () => {
      log.info("Elights platform 'didFinishLaunching'");

      const components = await getComponents()

      for(const c of components) {
        if(c.type === 'RelayOutput') {
          let acc = this.accessories.get(c.uuid)
          if(!acc) {
            log.info(`Found new component ${c.name} in ${c.room}`)
            acc = new Accessory(`${c.room}/${c.name}`, c.uuid);
            
            acc.addService(hap.Service.Outlet, `${c.room}/${c.name}`);
            this.configureAccessory(acc); // abusing the configureAccessory here
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [acc]);
          }
          acc.getService(hap.Service.Lightbulb)?.getCharacteristic(hap.Characteristic.On).setValue(c.value)
        }
      }
      // The idea of this plugin is that we open a http service which exposes api calls to add or remove accessories
      this.createHttpService();
    });
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log("Configuring accessory %s", accessory.displayName);

    accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log("%s identified!", accessory.displayName);
    });

    accessory.getService(hap.Service.Lightbulb)!.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.log.info(`${accessory.UUID} was set to: ${value}`);
        await setRelayOutput(accessory.UUID, value === true)
        callback();
      });

    this.accessories.set(accessory.UUID, accessory);
  }

  // --------------------------- CUSTOM METHODS ---------------------------
  private createHttpService() {
    this.requestServer = http.createServer(this.handleRequest.bind(this));
    this.requestServer.listen(18081, () => this.log.info("Http server listening on 18081..."));
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse) {
    {
      const m = request.url?.match(/\/uuid\/([0-9a-f-]+)\/(.*)/)
      if(m) {
        const acc = this.accessories.get(m[1])
        if(acc) {
          const charLightBulbOn = acc.getService(hap.Service.Lightbulb)?.getCharacteristic(hap.Characteristic.On)
          if(charLightBulbOn) {
            charLightBulbOn.updateValue(m[2] === 'true')
          }
        }
      }
    }

    {
      const m = request.url?.match(/\/removeAll/)
      if(m) {
        this.log.info("Removing all accessories");
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [...this.accessories.values()]);
        this.accessories.clear()
      }
    }

    response.writeHead(204); // 204 No content
    response.end();
  }

  // ----------------------------------------------------------------------

}
