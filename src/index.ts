
export type CoapMethod = "GET" | "POST" | "PUT" | "DELETE" | "FETCH" | "PATCH" | "iPATCH";

export interface Option {
  name: number | string;
  value: Buffer;
}

export type OptionName =
  | "If-Match"
  | "Uri-Host"
  | "ETag"
  | "If-None-Match"
  | "Observe"
  | "Uri-Port"
  | "Location-Path"
  | "Uri-Path"
  | "Content-Format"
  | "Max-Age"
  | "Uri-Query"
  | "Accept"
  | "Location-Query"
  | "Block2"
  | "Block1"
  | "Proxy-Uri"
  | "Proxy-Scheme"
  | "Size1";


export interface NamedOption {
  name: OptionName;
  value: Buffer;
}

export interface Packet {
  token?: Buffer;
  code?: CoapMethod | string;
  messageId?: number;
  payload?: Buffer;
  options?: (Option | NamedOption)[];
  confirmable?: boolean;
  reset?: boolean;
  ack?: boolean;
}

export interface ParsedPacket {
  code: string;
  confirmable: boolean;
  reset: boolean;
  ack: boolean;
  messageId: number;
  token: Buffer;
  options: (Option | NamedOption)[];
  payload: Buffer;
}



const empty = Buffer.alloc(0)

// a global index for parsing the options and the payload
// we can do this as the parsing is a sync operation
let index: number;

// last five bits are 1
// 31.toString(2) => '111111'
const lowerCodeMask = 31

let nextMsgId = Math.floor(Math.random() * 65535)

const codes: { [key: string]: number } = {
  'GET': 1,
  'POST': 2,
  'PUT': 3,
  'DELETE': 4,
  'FETCH': 5,
  'PATCH': 6,
  'iPATCH': 7,
  'get': 1,
  'post': 2,
  'put': 3,
  'delete': 4,
  'fetch': 5,
  'patch': 6,
  'ipatch': 7
}

export function generate(packet?: Packet): Buffer {
  let pos = 0

  packet = fillGenDefaults(packet)
  const options = prepareOptions(packet)
  const length = calculateLength(packet, options)

  if (length > 1280) {
    throw new Error('Max packet size is 1280: current is ' + length)
  }

  const buffer = Buffer.alloc(length)

  // first byte
  let byte = 0
  byte |= 1 << 6 // first two bits are version
  byte |= confirmableAckResetMask(packet)
  byte |= packet.token.length
  buffer.writeUInt8(byte, pos++)

  // code can be humanized or not
  if (codes[packet.code]) {
    buffer.writeUInt8(codes[packet.code], pos++)
  } else {
    buffer.writeUInt8(toCode(packet.code), pos++)
  }

  // two bytes for the message id
  buffer.writeUInt16BE(packet.messageId, pos)
  pos += 2

  // the token might be an empty buffer
  packet.token.copy(buffer, pos)
  pos += packet.token.length

  // write the options
  for (const option of options){
    option.copy(buffer, pos)
    pos += option.length
  }

  if (packet.code !== '0.00' && packet.payload.toString() !== '') {
    // payload separator
    buffer.writeUInt8(255, pos++)
    packet.payload.copy(buffer, pos)
  }

  return buffer
}

export function parse(buffer: Buffer): ParsedPacket {
  index = 4
  parseVersion(buffer)

  const result: ParsedPacket = {
    code: parseCode(buffer),
    confirmable: parseConfirmable(buffer),
    reset: parseReset(buffer),
    ack: parseAck(buffer),
    messageId: buffer.readUInt16BE(2),
    token: parseToken(buffer),
    options: null,
    payload: null
  }

  if (result.code !== '0.00') {
    result.options = parseOptions(buffer)
    result.payload = buffer.slice(index + 1)
  } else {
    if (buffer.length !== 4) {
      throw new Error('Empty messages must be empty')
    }

    result.options = []
    result.payload = empty
  }

  return result
}

function parseVersion(buffer: Buffer): number {
  const version = buffer.readUInt8(0) >> 6

  if (version !== 1) {
    throw new Error('Unsupported version')
  }

  return version
}

function parseConfirmable(buffer: Buffer): boolean {
  return (buffer.readUInt8(0) & 48) === 0
}

function parseReset(buffer: Buffer): boolean {
  // 110000 is 48
  return (buffer.readUInt8(0) & 48) === 48
}

function parseAck(buffer: Buffer): boolean {
  // 100000 is 32
  return (buffer.readUInt8(0) & 48) === 32
}

function parseCode(buffer: Buffer): string {
  let byte = buffer.readUInt8(1)
  let code = '' + (byte >> 5) + '.'

  byte = byte & lowerCodeMask

  if (byte < 10) {
    code += '0' + byte
  } else {
    code += byte
  }

  return code
}

function parseToken(buffer: Buffer): Buffer {
  const length = buffer.readUInt8(0) & 15

  if (length > 8) {
    throw new Error('Token length not allowed')
  }

  const result = buffer.slice(index, index + length)

  index += length

  return result
}

const numMap: { [id: string]: string } = {
  '1': 'If-Match',
  '3': 'Uri-Host',
  '4': 'ETag',
  '5': 'If-None-Match',
  '6': 'Observe',
  '7': 'Uri-Port',
  '8': 'Location-Path',
  '11': 'Uri-Path',
  '12': 'Content-Format',
  '14': 'Max-Age',
  '15': 'Uri-Query',
  '17': 'Accept',
  '20': 'Location-Query',
  '23': 'Block2',
  '27': 'Block1',
  '35': 'Proxy-Uri',
  '39': 'Proxy-Scheme',
  '60': 'Size1'
}

const optionNumberToString = (function genOptionParser() {
  let code = Object.keys(numMap).reduce((acc, key) =>{
    acc += 'case ' + key + ':\n'
    acc += '  return \'' + numMap[key] + '\'\n'

    return acc
  }, 'switch(number) {\n')

  code += 'default:\n'
  code += 'return \'\' + number'
  code += '}\n'

  return new Function('number', code) /* eslint-disable-line no-new-func */
})()

function parseOptions(buffer: Buffer): Option[] {
  let number = 0;
  const options: Option[] = [];

  while (index < buffer.length) {
    const byte = buffer.readUInt8(index)

    if (byte === 255 || index > buffer.length) {
      break
    }

    let delta = byte >> 4
    let length = byte & 15

    index += 1

    if (delta === 13) {
      delta = buffer.readUInt8(index) + 13
      index += 1
    } else if (delta === 14) {
      delta = buffer.readUInt16BE(index) + 269
      index += 2
    } else if (delta === 15) {
      throw new Error('Wrong option delta')
    }

    if (length === 13) {
      length = buffer.readUInt8(index) + 13
      index += 1
    } else if (length === 14) {
      length = buffer.readUInt16BE(index) + 269
      index += 2
    } else if (length === 15) {
      throw new Error('Wrong option length')
    }

    number += delta

    options.push({
      name: optionNumberToString(number),
      value: buffer.slice(index, index + length)
    })

    index += length
  }

  return options
}

function toCode(code: string): number {
  const split = code.split && code.split('.')
  let by = 0

  if (split && split.length === 2) {
    by |= parseInt(split[0]) << 5
    by |= parseInt(split[1])
  } else {
    const numeric_code = (!split) ? parseInt(code) : Number(code);

    by |= (numeric_code / 100) << 5
    by |= (numeric_code % 100)
  }

  return by
}

function fillGenDefaults(packet?: Packet): Packet {
  if (!packet) {
    packet = {}
  }

  if (!packet.payload) {
    packet.payload = empty
  }

  if (!packet.token) {
    packet.token = empty
  }

  if (packet.token.length > 8) {
    throw new Error('Token too long')
  }

  if (!packet.code) {
    packet.code = '0.01'
  }

  if (packet.messageId == null) {
    packet.messageId = nextMsgId++
  }

  if (!packet.options) {
    packet.options = []
  }

  if (nextMsgId === 65535) {
    nextMsgId = 0
  }

  if (!packet.confirmable) {
    packet.confirmable = false
  }

  if (!packet.reset) {
    packet.reset = false
  }

  if (!packet.ack) {
    packet.ack = false
  }

  return packet
}

function confirmableAckResetMask(packet: Packet): number {
  let result: number;

  if (packet.confirmable) {
    result = 0 << 4
  } else if (packet.ack) {
    result = 2 << 4
  } else if (packet.reset) {
    result = 3 << 4
  } else {
    result = 1 << 4 // the message is non-confirmable
  }

  return result
}

function calculateLength(packet: Packet, options: Buffer[]) {
  let length = 4 + packet.payload.length + packet.token.length

  if (packet.code !== '0.00' && packet.payload.toString() !== '') {
    length += 1
  }

  for (const option of options){
    length += option.length
  }

  return length
}

const optionStringToNumber = (function genOptionParser() {
  let code = Object.keys(numMap).reduce((acc, key) => {
    acc += 'case \'' + numMap[key] + '\':\n'
    acc += '  return \'' + key + '\'\n'

    return acc
  }, 'switch(string) {\n')

  code += 'default:\n'
  code += 'return parseInt(string)'
  code += '}\n'

  return new Function('string', code) /* eslint-disable-line no-new-func */
})()

const nameMap = Object.keys(numMap).reduce((acc, key) => {
  acc[numMap[key]] = key
  return acc
}, {} as { [id: string]: string })

function optionSorter(a: (Option | NamedOption), b: (Option | NamedOption)) {
  const a_name = a.name;
  const b_name = b.name;

  const a_value = parseInt(nameMap[String(a_name)] || String(a_name))
  const b_value = parseInt(nameMap[String(b_name)] || String(b_name))

  if (a_value < b_value) {
    return -1
  }
  if (a_value > b_value) {
    return 1
  }

  return 0
}

function prepareOptions(packet: Packet): Buffer[] {
  const options: Buffer[] = []
  let total = 0

  packet.options.sort(optionSorter)

  for (const packetOption of packet.options){
    let pos = 0
    const option = packetOption.name
    const delta = optionStringToNumber(option) - total
    const value = packetOption.value

    // max option length is 1 header, 2 ext numb, 2 ext length
    const buffer = Buffer.alloc(value.length + 5)

    let byte = 0

    if (delta <= 12) {
      byte |= delta << 4
    } else if (delta > 12 && delta < 269) {
      byte |= 13 << 4
    } else {
      byte |= 14 << 4
    }

    if (value.length <= 12) {
      byte |= value.length
    } else if (value.length > 12 && value.length < 269) {
      byte |= 13
    } else {
      byte |= 14
    }

    buffer.writeUInt8(byte, pos++)

    if (delta > 12 && delta < 269) {
      buffer.writeUInt8(delta - 13, pos++)
    } else if (delta >= 269) {
      buffer.writeUInt16BE(delta - 269, pos)
      pos += 2
    }

    if (value.length > 12 && value.length < 269) {
      buffer.writeUInt8(value.length - 13, pos++)
    } else if (value.length >= 269) {
      buffer.writeUInt16BE(value.length - 269, pos)
      pos += 2
    }

    value.copy(buffer, pos)
    pos += value.length
    total += delta
    options.push(buffer.slice(0, pos))
  }

  return options
}
