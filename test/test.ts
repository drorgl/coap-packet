
import * as packetHandling from "../src/index";
const generate = packetHandling.generate
const parse = packetHandling.parse
// const expect = require('chai').expect
import { expect } from "chai";
import { Packet } from "../src";
import "mocha";

describe('packet.parse', () => {
  let packet: Packet;
  let buffer: Buffer;
  let byte: number;

  describe('with no options', () => {
    function buildPacket(payload: Buffer) {
      buffer = Buffer.alloc(5 + payload.length)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 1 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a get

      buffer.writeUInt16BE(42, 2) // the message ID

      buffer.writeUInt8(255, 4) // payload separator

      payload.copy(buffer, 5) // copy the payload
    }

    beforeEach(() => {
      buildPacket(Buffer.alloc(0))
    })

    it('should throw if it reads version two', () => {
      buffer.writeUInt8(2 << 6, 0)
      expect(parse.bind(null, buffer)).to.throw('Unsupported version')
    })

    it('should parse the code (get)', () => {
      packet = parse(buffer)
      expect(packet).to.have.property('code', '0.01')
    })

    it('should parse the code (post)', () => {
      buffer.writeUInt8(2, 1) // it is a post

      packet = parse(buffer)
      expect(packet).to.have.property('code', '0.02')
    })

    it('should parse the code (created)', () => {
      buffer.writeUInt8(2 << 5 | 1, 1) // it is a 2.00 created

      packet = parse(buffer)
      expect(packet).to.have.property('code', '2.01')
    })

    it('should parse the code (not found)', () => {
      buffer.writeUInt8(4 << 5 | 4, 1) // it is a 4.04

      packet = parse(buffer)
      expect(packet).to.have.property('code', '4.04')
    })

    it('should parse the message id', () => {
      buffer.writeUInt16BE(42, 2)

      packet = parse(buffer)
      expect(packet).to.have.property('messageId', 42)
    })

    it('should parse the empty payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(Buffer.alloc(0))
    })

    it('should parse some payload', () => {
      const payload = Buffer.from('hello matteo')
      buildPacket(payload)
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    it('should parse some payload (bis)', () => {
      const payload = Buffer.from('hello matteo')
      buildPacket(payload)
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    it('should have no options', () => {
      expect(parse(buffer).options).to.eql([])
    })

    it('should parse non-confirmable non-reset non-ack', () => {
      packet = parse(buffer)
      expect(packet).to.have.property('confirmable', false)
      expect(packet).to.have.property('reset', false)
      expect(packet).to.have.property('ack', false)
    })

    it('should parse an empty message', () => {
      buffer = Buffer.alloc(4)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 1 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(0, 1) // it is an empty message

      buffer.writeUInt16BE(42, 2) // the message ID

      packet = parse(buffer)

      expect(packet.code).to.eql('0.00')
      expect(packet.payload).to.eql(Buffer.alloc(0))
    })

    it('should raise an error if an empty message is longer than 5', () => {
      buffer = Buffer.alloc(5)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 1 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(0, 1) // it is an empty message

      buffer.writeUInt16BE(42, 2) // the message ID

      expect(parse.bind(null, buffer)).to.throw('Empty messages must be empty')
    })

    it('should parse confirmable non-reset non-ack', () => {
      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      packet = parse(buffer)
      expect(packet).to.have.property('confirmable', true)
      expect(packet).to.have.property('reset', false)
      expect(packet).to.have.property('ack', false)
    })

    it('should parse non-confirmable non-reset ack', () => {
      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 2 << 4 // the message is ack
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      packet = parse(buffer)
      expect(packet).to.have.property('confirmable', false)
      expect(packet).to.have.property('reset', false)
      expect(packet).to.have.property('ack', true)
    })

    it('should parse non-confirmable reset non-ack', () => {
      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 3 << 4 // the message is reset
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      packet = parse(buffer)
      expect(packet).to.have.property('confirmable', false)
      expect(packet).to.have.property('reset', true)
      expect(packet).to.have.property('ack', false)
    })

    it('should have a zero-length token', () => {
      packet = parse(buffer)
      expect(packet.token).to.eql(Buffer.alloc(0))
    })
  })

  describe('with a payload and a single option with unextended number and length', () => {
    const payload = Buffer.alloc(5)
    const optionValue = Buffer.alloc(3)

    beforeEach(() => {
      buffer = Buffer.alloc(6 + optionValue.length + payload.length)
      buffer.fill(0)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a post

      buffer.writeUInt16BE(42, 2) // the message ID

      byte = 0
      byte |= 1 << 4 // the option number 1
      byte |= optionValue.length // the length is lower than 13.

      buffer.writeUInt8(byte, 4)
      optionValue.copy(buffer, 5)

      buffer.writeUInt8(255, 5 + optionValue.length) // payload separator

      payload.copy(buffer, 6 + optionValue.length) // copy the payload
    })

    it('should parse the payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    it('should parse a message with no payload and payload separator', () => {
      parse(buffer.slice(0, 5))
    })

    const options: { [key: string]: number } = {
      'If-Match': 1,
      'Uri-Host': 3,
      ETag: 4,
      'If-None-Match': 5,
      Observe: 6,
      'Uri-Port': 7,
      'Location-Path': 8,
      'Uri-Path': 11,
      'Content-Format': 12,

      // this is not specified by the protocol,
      // but it's needed to check if it can parse
      // numbers
      9: 9
    }

    Object.keys(options).forEach(function (option) {
      it('should parse ' + option, () => {
        byte = 0
        byte |= options[option] << 4
        byte |= optionValue.length

        buffer.writeUInt8(byte, 4)

        packet = parse(buffer)
        expect(packet.options).to.eql([{ name: option, value: optionValue }])
      })
    })
  })

  describe('with a payload and a single option with one-byte extended number and unextended length', () => {
    const payload = Buffer.alloc(5)
    const optionValue = Buffer.alloc(3)

    beforeEach(() => {
      buffer = Buffer.alloc(7 + optionValue.length + payload.length)
      buffer.fill(0)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a post

      buffer.writeUInt16BE(42, 2) // the message ID

      byte = 0
      byte |= 13 << 4 // the option number is extended by one byte
      byte |= optionValue.length // the length is lower than 13.

      buffer.writeUInt8(byte, 4)
      buffer.writeUInt8(0, 5) // the one-byte extended option number
      optionValue.copy(buffer, 6)

      buffer.writeUInt8(255, 6 + optionValue.length) // payload separator

      payload.copy(buffer, 7 + optionValue.length) // copy the payload
    })

    it('should parse the payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    const options: { [key: string]: string } = {

      '14': 'Max-Age',
      '15': 'Uri-Query',
      '17': 'Accept',
      '20': 'Location-Query',
      '35': 'Proxy-Uri',
      '39': 'Proxy-Scheme',
      '60': 'Size1',

      // this is not specified by the protocol,
      // but it's needed to check if it can parse
      // numbers
      '16': '16'
    }

    Object.keys(options).forEach((num) => {
      const option = options[num]

      it('should parse ' + option, () => {
        buffer.writeUInt8(parseInt(num) - 13, 5)

        packet = parse(buffer)
        expect(packet.options).to.eql([{ name: option, value: optionValue }])
      })
    })
  })

  describe('with a payload and a single option with two-byte extended number and unextended length', () => {
    const payload = Buffer.alloc(5)
    const optionValue = Buffer.alloc(3)

    beforeEach(() => {
      buffer = Buffer.alloc(8 + optionValue.length + payload.length)
      buffer.fill(0)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a post

      buffer.writeUInt16BE(42, 2) // the message ID

      byte = 0
      byte |= 14 << 4 // the option number is extended by two bytes
      byte |= optionValue.length // the length is lower than 13.

      buffer.writeUInt8(byte, 4)
      buffer.writeUInt16BE(789 - 269, 5) // the two-byte extended option number
      optionValue.copy(buffer, 7)

      buffer.writeUInt8(255, 7 + optionValue.length) // payload separator

      payload.copy(buffer, 8 + optionValue.length) // copy the payload
    })

    it('should parse the payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    const options = [270, 678, 1024]

    options.forEach(function (num) {
      const option = (num).toString()

      it('should parse ' + option, () => {
        buffer.writeUInt16BE(num - 269, 5)

        packet = parse(buffer)

        expect(packet.options).to.eql([{ name: option, value: optionValue }])
      })
    })
  })

  describe('with a payload and a single option with unextended number and one-byte extended length', () => {
    const payload = Buffer.alloc(5)
    const optionValue = Buffer.alloc(20)

    beforeEach(() => {
      buffer = Buffer.alloc(7 + optionValue.length + payload.length)
      buffer.fill(0)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a post

      buffer.writeUInt16BE(42, 2) // the message ID

      byte = 0
      byte |= 1 << 4 // the option number 1
      byte |= 13 // the option lenght is one byte more

      buffer.writeUInt8(byte, 4)
      buffer.writeUInt8(optionValue.length - 13, 5)
      optionValue.copy(buffer, 6)

      buffer.writeUInt8(255, 6 + optionValue.length) // payload separator

      payload.copy(buffer, 7 + optionValue.length) // copy the payload
    })

    it('should parse the payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    it('should parse the option value', () => {
      packet = parse(buffer)
      expect(packet.options).to.eql([{ name: 'If-Match', value: optionValue }])
    })
  })

  describe('with a payload and a single option with unextended number and two-byte extended length', () => {
    const payload = Buffer.alloc(5)
    const optionValue = Buffer.alloc(1024)

    beforeEach(() => {
      buffer = Buffer.alloc(8 + optionValue.length + payload.length)
      buffer.fill(0)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a post

      buffer.writeUInt16BE(42, 2) // the message ID

      byte = 0
      byte |= 1 << 4 // the option number 1
      byte |= 14 // the option length is two byte more

      buffer.writeUInt8(byte, 4)
      buffer.writeUInt16BE(optionValue.length - 269, 5)
      optionValue.copy(buffer, 7)

      buffer.writeUInt8(255, 7 + optionValue.length) // payload separator

      payload.copy(buffer, 8 + optionValue.length) // copy the payload
    })

    it('should parse the payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    it('should parse the option value', () => {
      packet = parse(buffer)
      expect(packet.options).to.eql([{ name: 'If-Match', value: optionValue }])
    })
  })

  describe('with a payload and a single option with both number and length extended by one byte', () => {
    const payload = Buffer.alloc(5)
    const optionValue = Buffer.alloc(20)

    beforeEach(() => {
      buffer = Buffer.alloc(8 + optionValue.length + payload.length)
      buffer.fill(0)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a post

      buffer.writeUInt16BE(42, 2) // the message ID

      byte = 0
      byte |= 13 << 4 // the number is extended by one byte
      byte |= 13 // the option lenght is one byte more

      buffer.writeUInt8(byte, 4)

      buffer.writeUInt8(42 - 13, 5) // option number is 42
      buffer.writeUInt8(optionValue.length - 13, 6)

      optionValue.copy(buffer, 7)

      buffer.writeUInt8(255, 7 + optionValue.length) // payload separator

      payload.copy(buffer, 8 + optionValue.length) // copy the payload
    })

    it('should parse the payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    it('should parse the option value', () => {
      packet = parse(buffer)
      expect(packet.options).to.eql([{ name: '42', value: optionValue }])
    })
  })

  describe('with a payload and two unextended options', () => {
    const payload = Buffer.alloc(5)
    const optionValue = Buffer.alloc(3)

    beforeEach(() => {
      buffer = Buffer.alloc(7 + optionValue.length * 2 + payload.length)
      buffer.fill(0)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is non-confirmable
      byte |= 0 // the TKL length is zero

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a post

      buffer.writeUInt16BE(42, 2) // the message ID

      byte = 0
      byte |= 1 << 4 // the option number 1
      byte |= optionValue.length // the length is lower than 13.

      buffer.writeUInt8(byte, 4)
      optionValue.copy(buffer, 5)

      byte = 0
      byte |= 2 - 1 << 4 // the option number 1
      byte |= optionValue.length // the length is lower than 13.

      buffer.writeUInt8(byte, 5 + optionValue.length)
      optionValue.copy(buffer, 6 + optionValue.length)

      buffer.writeUInt8(255, 6 + optionValue.length * 2) // payload separator

      payload.copy(buffer, 7 + optionValue.length * 2) // copy the payload
    })

    it('should parse the payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    const options: { [key: string]: number } = {
      'If-Match': 1,
      'Uri-Host': 3,
      ETag: 4,
      'If-None-Match': 5,
      'Uri-Port': 7,
      'Location-Path': 8,
      'Uri-Path': 11,
      'Content-Format': 12,

      // this is not specified by the protocol,
      // but it's needed to check if it can parse
      // numbers
      9: 9
    }

    Object.keys(options).forEach(function (option) {
      it('should parse ' + option, () => {
        byte = 0
        byte |= options[option] - 1 << 4
        byte |= optionValue.length

        buffer.writeUInt8(byte, 5 + optionValue.length)

        packet = parse(buffer)
        expect(packet.options).to.eql([{
          name: 'If-Match',
          value: optionValue
        }, {
          name: option,
          value: optionValue
        }])
      })
    })
  })

  describe('with a payload an unextended option and a token', () => {
    const payload = Buffer.alloc(5)
    const optionValue = Buffer.alloc(3)
    const token = Buffer.alloc(3)

    beforeEach(() => {
      buffer = Buffer.alloc(6 + token.length + optionValue.length + payload.length)
      buffer.fill(0)

      byte = 0
      byte |= 1 << 6 // byte two bits are version
      byte |= 0 << 4 // the message is non-confirmable
      byte |= token.length // the TKL length

      buffer.writeUInt8(byte, 0)

      buffer.writeUInt8(1, 1) // it is a post

      buffer.writeUInt16BE(42, 2) // the message ID

      token.copy(buffer, 4)

      byte = 0
      byte |= 1 << 4 // the option number 1
      byte |= optionValue.length // the length is lower than 13.

      buffer.writeUInt8(byte, 4 + token.length)
      optionValue.copy(buffer, 5 + token.length)

      buffer.writeUInt8(255, 5 + token.length + optionValue.length) // payload separator

      payload.copy(buffer, 6 + token.length + optionValue.length) // copy the payload
    })

    it('should parse the payload', () => {
      packet = parse(buffer)
      expect(packet.payload).to.eql(payload)
    })

    it('should parse the token', () => {
      packet = parse(buffer)
      expect(packet.token).to.eql(token)
    })
  })
})

describe('packet.generate', () => {
  let packet: Packet;
  let buffer: Buffer;
  let byte: number;

  describe('with no parameters', () => {
    beforeEach(() => {
      buffer = generate()
    })

    it('should have version 1', () => {
      byte = buffer.readUInt8(0) & parseInt('11000000', 2)
      expect(byte >> 6).to.equal(1)
    })

    it('should be non confirmable', () => {
      byte = buffer.readUInt8(0) & parseInt('00110000', 2)
      expect(byte >> 4).to.equal(1)
    })

    it('should have no token length', () => {
      byte = buffer.readUInt8(0) & parseInt('00001111', 2)
      expect(byte).to.equal(0)
    })

    it('should be a GET', () => {
      byte = buffer.readUInt8(1)
      expect(byte).to.equal(1)
    })

    it('should have a message id', () => {
      expect(buffer.readUInt16BE(2)).not.to.equal(0)
    })

    it('should have a different message id than the previous packet', () => {
      const msgId1 = buffer.readUInt16BE(2)
      const buffer2 = generate()
      const msgId2 = buffer2.readUInt16BE(2)

      expect(msgId1).not.to.eql(msgId2)
    })

    it('should not have the payload separator', () => {
      expect(buffer.length).to.equal(4)
    })
  })

  describe('with parameters', () => {
    let payload,
      token

    it('should generate a non-confirmable message', () => {
      buffer = generate({ confirmable: false })
      byte = buffer.readUInt8(0) & parseInt('00110000', 2)
      expect(byte >> 4).to.equal(1)
    })

    it('should generate a confirmable message', () => {
      buffer = generate({ confirmable: true })
      byte = buffer.readUInt8(0) & parseInt('00110000', 2)
      expect(byte >> 4).to.equal(0)
    })

    it('should generate an ack message', () => {
      buffer = generate({ ack: true })
      byte = buffer.readUInt8(0) & parseInt('00110000', 2)
      expect(byte >> 4).to.equal(2)
    })

    it('should generate a reset message', () => {
      buffer = generate({ reset: true })
      byte = buffer.readUInt8(0) & parseInt('00110000', 2)
      expect(byte >> 4).to.equal(3)
    })

    it('should generate a payload marker', () => {
      payload = Buffer.alloc(42)
      buffer = generate({ payload: payload })
      expect(buffer.readUInt8(4)).to.eql(0xFF)
    })

    it('should generate a payload', () => {
      payload = Buffer.alloc(42)
      buffer = generate({ payload: payload })
      expect(buffer.slice(5)).to.eql(payload)
    })

    it('should error if the resulting message is greater than 1280', () => {
      payload = Buffer.alloc(1280 - 4) // the basic headers are 4
      expect(generate.bind(null, { payload: payload })).to.throw('Max packet size is 1280: current is 1281')
    })

    it('should use a given messageId', () => {
      buffer = generate({ messageId: 42 })
      expect(buffer.readUInt16BE(2)).to.equal(42)
    })

    it('should generate a token', () => {
      token = Buffer.alloc(3)
      buffer = generate({ token: token })
      expect(buffer.slice(4, 7)).to.eql(token)
    })

    it('should generate the token length', () => {
      token = Buffer.alloc(3)
      buffer = generate({ token: token })
      byte = buffer.readUInt8(0) & parseInt('00001111', 2)
      expect(byte).to.equal(3)
    })

    it('should have a maximum token length of 8', () => {
      token = Buffer.alloc(9)
      expect(generate.bind(null, { token: token })).to.throw('Token too long')
    })

    it('should send a given code', () => {
      buffer = generate({ code: '0.02' })
      byte = buffer.readUInt8(1)
      expect(byte).to.equal(2)
    })

    const codes :{[key:string]:number}= {
      'GET': 1,
      'POST': 2,
      'PUT': 3,
      'DELETE': 4
    }

    Object.keys(codes).forEach((key) =>{
      it('should send ' + key + ' passing the code in human format', () => {
        buffer = generate({ code: key })
        byte = buffer.readUInt8(1)
        expect(byte).to.equal(codes[key])
      })

      it('should send ' + key + ' passing the code in human format (lowercase)', () => {
        buffer = generate({ code: key.toLowerCase() })
        byte = buffer.readUInt8(1)
        expect(byte).to.equal(codes[key])
      })
    })

    const shortOptions : {[key:string]:number} = {
      'If-Match': 1,
      'Uri-Host': 3,
      ETag: 4,
      'If-None-Match': 5,
      Observe: 6,
      'Uri-Port': 7,
      'Location-Path': 8,
      'Uri-Path': 11,
      'Content-Format': 12,

      // this is not specified by the protocol,
      // but it's needed to check if it can parse
      // numbers
      9: 9
    }

    Object.keys(shortOptions).forEach((option)=> {
      it('should generate ' + option + ' option with unextended length', () => {
        packet = {
          options: [{
            name: option,
            value: Buffer.alloc(5)
          }]
        }

        buffer = generate(packet)

        expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(shortOptions[option])
        expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(packet.options[0].value.length)
        expect(buffer.slice(5, 10)).to.eql(packet.options[0].value)
      })

      it('should generate ' + option + ' option with one-byte extended length', () => {
        packet = {
          options: [{
            name: option,
            value: Buffer.alloc(20)
          }]
        }

        buffer = generate(packet)

        expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(shortOptions[option])
        expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(13)
        expect(buffer.readUInt8(5)).to.eql(packet.options[0].value.length - 13)
        expect(buffer.slice(6, 26)).to.eql(packet.options[0].value)
      })

      it('should generate ' + option + ' option with two-byte extended length', () => {
        packet = {
          options: [{
            name: option,
            value: Buffer.alloc(300)
          }]
        }

        buffer = generate(packet)

        expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(shortOptions[option])
        expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(14)
        expect(buffer.readUInt16BE(5)).to.eql(packet.options[0].value.length - 269)
        expect(buffer.slice(7, 307)).to.eql(packet.options[0].value)
      })

      if (shortOptions[option] !== 1) {
        it('should generate ' + option + ' option following another option', () => {
          packet = {
            options: [{
              name: option,
              value: Buffer.alloc(5)
            }, {
              name: 'If-Match',
              value: Buffer.alloc(5)
            }]
          }

          buffer = generate(packet)

          expect((buffer.readUInt8(10) & parseInt('11110000', 2)) >> 4).to.eql(shortOptions[option] - 1)
          // it is in position 1 as it is automatically sorted by generate
          expect((buffer.readUInt8(10) & parseInt('00001111', 2))).to.eql(packet.options[1].value.length)
          expect(buffer.slice(11, 16)).to.eql(packet.options[1].value)
        })
      }
    })

    const longOptions :{[key:string]:number} = {
      'Max-Age': 14,
      'Uri-Query': 15,
      16: 16, // unknown, just to be sure it parses
      Accept: 17,
      'Location-Query': 20,
      Block2: 23,
      Block1: 27,
      'Proxy-Uri': 35,
      'Proxy-Scheme': 39,
      Size1: 60
    }

    Object.keys(longOptions).forEach(function (option) {
      it('should generate ' + option + ' option with unextended length', () => {
        packet = {
          options: [{
            name: option,
            value: Buffer.alloc(5)
          }]
        }

        buffer = generate(packet)

        expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(13)
        expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(packet.options[0].value.length)
        expect(buffer.readUInt8(5)).to.eql(longOptions[option] - 13)
        expect(buffer.slice(6, 11)).to.eql(packet.options[0].value)
      })

      it('should generate ' + option + ' option with one-byte extended length', () => {
        packet = {
          options: [{
            name: option,
            value: Buffer.alloc(20)
          }]
        }

        buffer = generate(packet)

        expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(13)
        expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(13)
        expect(buffer.readUInt8(5)).to.eql(longOptions[option] - 13)
        expect(buffer.readUInt8(6)).to.eql(packet.options[0].value.length - 13)
        expect(buffer.slice(7, 27)).to.eql(packet.options[0].value)
      })

      it('should generate ' + option + ' option with two-byte extended length', () => {
        packet = {
          options: [{
            name: option,
            value: Buffer.alloc(300)
          }]
        }

        buffer = generate(packet)

        expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(13)
        expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(14)
        expect(buffer.readUInt8(5)).to.eql(longOptions[option] - 13)
        expect(buffer.readUInt16BE(6)).to.eql(packet.options[0].value.length - 269)
        expect(buffer.slice(8, 308)).to.eql(packet.options[0].value)
      })
    })

      ;['560', '720'].forEach(function (option) {
        const optionNum = '' + option

        it('should generate ' + option + ' option with unextended length', () => {
          packet = {
            options: [{
              name: option,
              value: Buffer.alloc(5)
            }]
          }

          buffer = generate(packet)

          expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(14)
          expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(packet.options[0].value.length)
          expect(buffer.readUInt16BE(5)).to.eql(Number(optionNum) - 269)
          expect(buffer.slice(7, 12)).to.eql(packet.options[0].value)
        })

        it('should generate ' + option + ' option with one-byte extended length', () => {
          packet = {
            options: [{
              name: option,
              value: Buffer.alloc(20)
            }]
          }

          buffer = generate(packet)

          expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(14)
          expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(13)
          expect(buffer.readUInt16BE(5)).to.eql(Number(optionNum) - 269)
          expect(buffer.readUInt8(7)).to.eql(packet.options[0].value.length - 13)
          expect(buffer.slice(8, 28)).to.eql(packet.options[0].value)
        })

        it('should generate ' + option + ' option with two-byte extended length', () => {
          packet = {
            options: [{
              name: option,
              value: Buffer.alloc(300)
            }]
          }

          buffer = generate(packet)

          expect((buffer.readUInt8(4) & parseInt('11110000', 2)) >> 4).to.eql(14)
          expect((buffer.readUInt8(4) & parseInt('00001111', 2))).to.eql(14)
          expect(buffer.readUInt16BE(5)).to.eql(Number(optionNum) - 269)
          expect(buffer.readUInt16BE(7)).to.eql(packet.options[0].value.length - 269)
          expect(buffer.slice(9, 309)).to.eql(packet.options[0].value)
        })
      })
  })
})

describe('parse and generate', () => {
  let orig

  it('should process an empty packet', () => {
    orig = {}
    // orig will be filled with the defaults by generate
    expect(parse(generate(orig))).to.eql(orig)
  })

  it('should process a payload', () => {
    orig = { payload: Buffer.alloc(5) }
    // orig will be filled with the defaults by generate
    expect(parse(generate(orig))).to.eql(orig)
  })

  it('should process a short option', () => {
    orig = {
      options: [{
        name: 'If-Match',
        value: Buffer.alloc(5)
      }]
    }

    // orig will be filled with the defaults by generate
    expect(parse(generate(orig))).to.eql(orig)
  })

  it('should process a packet with all stuff', () => {
    orig = {
      token: Buffer.alloc(4),
      code: '0.01',
      messageId: 42,
      payload: Buffer.alloc(400),
      options: [{
        name: 'If-Match',
        value: Buffer.alloc(5)
      }, {
        name: 'Uri-Path',
        value: Buffer.from('hello')
      }]
    }

    // orig will be filled with the defaults by generate
    expect(parse(generate(orig))).to.eql(orig)
  })

  it('should send and parse a code sent in HTTP-format', () => {
    expect(parse(generate({ code: '500' }))).to.have.property('code', '5.00')
  })

  it('should send and parse a code sent in numeric HTTP-format', () => {
    expect(parse(generate({ code: '500' }))).to.have.property('code', '5.00')
  })

  it('should send an ack', () => {
    expect(parse(generate({ ack: true }))).to.have.property('ack', true)
  })

  it('should send an empty message', () => {
    expect(parse(generate({ code: '0.00', ack: true }))).to.have.property('ack', true)
  })

  it('should process a packet with Uri-Path and Observe', () => {
    orig = {
      token: Buffer.alloc(4),
      code: '2.05',
      messageId: 42,
      payload: Buffer.alloc(400),
      options: [{
        name: 'Uri-Path',
        value: Buffer.from('aaa')
      }, {
        name: 'Uri-Path',
        value: Buffer.from('bbb')
      }, {
        name: 'Observe',
        value: Buffer.from([42])
      }]
    }

    // orig will be filled with the defaults by generate
    expect(parse(generate(orig))).to.eql(orig)
  })
})
