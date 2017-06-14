import DbcUtils from '../../utils/dbc';
const UINT64 = require('cuint').UINT64

import Bitarray from '../bitarray';

export default class Signal {
    constructor({name,
                startBit = 0,
                size = 0,
                isLittleEndian = true,
                isSigned = true,
                isFloat = false,
                factor = 1,
                offset = 0,
                unit = "",
                receiver = ['XXX'],
                comment = null,
                multiplex = null,
                min = null,
                max = null
                }) {
        Object.assign(this,
            {name,
            startBit,
            size,
            isLittleEndian,
            isSigned,
            isFloat,
            factor,
            offset,
            unit,
            receiver,
            comment,
            multiplex});

        if(min == null) {
            min = this.calculateMin();
        }
        if(max == null) {
            max = this.calculateMax();
        }

        Object.assign(this, {min, max});
    }

    text() {
        const multiplex = this.multiplex ? ' ' + this.multiplex : '';
        const byteOrder = this.isLittleEndian ? 1 : 0;
        const signedChar = this.isSigned ? '-' : '+';

        return `SG_ ${this.name}${multiplex} : ` +
               `${this.startBit}|${this.size}@${byteOrder}${signedChar}` +
               ` (${this.factor},${this.offset})` +
               ` [${this.min}|${this.max}]` +
               ` "${this.unit}" ${this.receiver}`
    }

    littleEndianBitDescription(bitIndex) {
        const bitRange = [this.startBit, this.startBit + this.size - 1];
        if (bitIndex < bitRange[0] || bitIndex > bitRange[1]) {
            return null;
        } else {
            const bitNumber = bitIndex - bitRange[0];
            const isLsb = bitIndex === bitRange[0];
            const isMsb = bitIndex === bitRange[1];
            return {bitNumber, isLsb, isMsb};
        }
    }

    bigEndianBitDescription(bitIndex) {
        const start = DbcUtils.bigEndianBitIndex(this.startBit);
        const range = [DbcUtils.bigEndianBitIndex(this.startBit), start + this.size - 1];
        const bitNumber = DbcUtils.bigEndianBitIndex(bitIndex);

        if(bitNumber < range[0] || bitNumber > range[1]) {
            return null;
        }

        const isLsb = bitNumber === range[1];
        const isMsb = bitIndex === this.startBit;
        return {bitNumber, isLsb, isMsb, range};
    }

    bitDescription(bitIndex) {
        if(this.isLittleEndian) {
            return this.littleEndianBitDescription(bitIndex);
        } else {
            return this.bigEndianBitDescription(bitIndex);
        }
    }

    calculateRawRange() {
        let rawRange = Math.pow(2, this.size);
        if (this.isSigned) {
            rawRange /= 2;
        }
        return [(this.isSigned ? -1 * rawRange : 0),
                rawRange - 1]
    }

    calculateMin() {
        const rawMin = this.calculateRawRange()[0];
        return this.offset + (rawMin * this.factor);
    }

    calculateMax() {
        const rawMax = this.calculateRawRange()[1];
        return this.offset + (rawMax * this.factor);
    }

    valueForInt32Signal(signalSpec, bits, bitsSwapped) {
        let value, startBit, dataBitPos, bitArr;

        if (signalSpec.isLittleEndian) {
            bitArr = bitsSwapped;
            startBit = signalSpec.startBit;
        } else {
            bitArr = bits;
            startBit = DbcUtils.bigEndianBitIndex(signalSpec.startBit);
        }
        let ival = Bitarray.extract(bitArr, startBit, signalSpec.size);

        if(signalSpec.isSigned && (ival & (1<<(signalSpec.size - 1)))) {
            ival -= 1<<signalSpec.size
        }
        ival = (ival * signalSpec.factor) + signalSpec.offset;
        return ival;
    }

    valueForInt64Signal(signalSpec, hexData) {
        const blen = hexData.length * 4;
        let value, startBit, dataBitPos;

        if (signalSpec.isLittleEndian) {
            // TODO use buffer swap
            // value = UINT64(swapOrder(hexData, 16, 2), 16);
            startBit = signalSpec.startBit;
            dataBitPos = UINT64.fromNumber(startBit);
        } else {
            // big endian
            value = UINT64(hexData, 16);

            startBit = DbcUtils.bigEndianBitIndex(signalSpec.startBit);
            dataBitPos = UINT64(blen - (startBit + signalSpec.size));
        }
        if(dataBitPos < 0) {
            return null;
        }

        let rightHandAnd = UINT64((1 << signalSpec.size) - 1);
        let ival = (value.shiftr(dataBitPos)).and(rightHandAnd).toNumber();

        if(signalSpec.isSigned && (ival & (1<<(signalSpec.size - 1)))) {
            ival -= 1<<signalSpec.size
        }
        ival = (ival * signalSpec.factor) + signalSpec.offset;
        return ival;
    }

    value(dataBuf) {

    }

    equals(otherSignal) {
        return (otherSignal.name == this.name
                && otherSignal.startBit == this.startBit
                && otherSignal.size == this.size
                && otherSignal.isLittleEndian == this.isLittleEndian
                && otherSignal.isSigned == this.isSigned
                && otherSignal.isFloat == this.isFloat
                && otherSignal.factor == this.factor
                && otherSignal.offset == this.offset
                && otherSignal.unit == this.unit
                && otherSignal.receiver.length==this.receiver.length
                && otherSignal.receiver.every((v,i)=> v === this.receiver[i])
                && otherSignal.comment == this.comment
                && otherSignal.multiplex == this.multiplex);
    }
}