import { Address, Cell, beginCell, storeStateInit, address } from '@ton/core';

const USDT_JETTON_WALLET_CODE = Cell.fromBoc(Buffer.from('b5ee9c72010101010023000842028f452d7a4dfd74066b682365177259ed05734435be76b5fd4bd5d8af2b7c3d68', 'hex'))[0]!;
const USDT_JETTON_MASTER_ADDRESS = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');

export const findWalletUsdtJettonAddress = (wallet: string): Address => {
    const jettonWalletStateInit = beginCell().store(storeStateInit({
        code: USDT_JETTON_WALLET_CODE,
        data: beginCell()
            .storeUint(0, 4)
            .storeCoins(0)
            .storeSlice(beginCell().storeAddress(Address.parse(wallet)).endCell().beginParse())
            .storeSlice(beginCell().storeAddress(USDT_JETTON_MASTER_ADDRESS).endCell().beginParse())
            .endCell()
    }))
        .endCell();

    return new Address(0, jettonWalletStateInit.hash());
};
