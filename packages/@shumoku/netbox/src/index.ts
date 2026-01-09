/**
 * @shumoku/netbox
 * NetBox API client and Shumoku converter
 */

export { NetBoxClient } from './client.js'
export { convertToNetworkGraph, toYaml } from './converter.js'
export type {
  // NetBox API types
  NetBoxTag,
  NetBoxDevice,
  NetBoxDeviceResponse,
  NetBoxVlan,
  NetBoxInterface,
  NetBoxInterfaceResponse,
  NetBoxTermination,
  NetBoxCable,
  NetBoxCableResponse,
  // Configuration types
  TagMapping,
  ConverterOptions,
  NetBoxClientOptions,
  // Internal types
  DeviceData,
  ConnectionData,
} from './types.js'
export {
  DEFAULT_TAG_MAPPING,
  TAG_PRIORITY,
  CABLE_COLORS,
  getVlanColor,
} from './types.js'
