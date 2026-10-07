import type { Payment } from '@breeztech/breez-sdk-spark';

/**
 * Synthetic wallet payments in the SDK's own `Payment` shape, newest first,
 * for the `?visual=history-rows` list and the payment screen pins (Playwright
 * builds only). Nothing here is real data. The values are internally
 * consistent, and the unit tests hold them to it: each Lightning invoice is a
 * BOLT11 invoice whose amount field matches the payment, each payment hash is
 * the SHA-256 of its preimage, the zap request is a kind-9734 event, ids are
 * UUIDs, and the list nets to the 21,000-sat visual balance (failed payments
 * excluded, pending sends deducted).
 */
export const WALLET_PAYMENT_FIXTURES: readonly Payment[] = [
  {
    id: 'f43f0362-edf9-4387-8edb-e18af9bb4dbc',
    paymentType: 'receive',
    status: 'completed',
    amount: BigInt(2100),
    fees: BigInt(0),
    timestamp: 1767783600,
    method: 'lightning',
    details: {
      type: 'lightning',
      invoice:
        'lnbc21000n1p54u09dpp5gyjj0mzas99ht7ryr67cwkllhun2zxmurqpcpcc7sv7hwl86nkyshp5ewnunlsxs9mz7ctw5x5a8re84asfyuhxr7herhyx54qlz20whr5qsp5jfj99cwq9xupzqzpsgnuphgyhe6mxd5jl62lyz49tyw69w6n4psqxqyz5vqcqzys9qrsgqmqfjzd27gnahsy8am5wzu7msxj7gexnmdxat8ktd2udmgnvdc5kn2ht6me8lauqfmpqenapt7f48qjydeszuf8wjvv9r7vstwxnc4ssp3nm62j',
      destinationPubkey: '03619e188effcd645a7937fffe69e442f96071b60b3feaf44c3380cb63d5171383',
      htlcDetails: {
        paymentHash: '412527ec5d814b75f8641ebd875bffbf26a11b7c180380e31e833d777cfa9d89',
        expiryTime: 1767869997,
        status: 'preimageShared',
        preimage: '7bd997e82672dfed725f445e554a551ddeece28c2222a2d16a072db1894427dd',
      },
      lnurlReceiveMetadata: {
        nostrZapRequest:
          '{"pubkey":"ef4eb07d6fadb63f70b8e0d94438c332a9932f0b8daae11f21597f1b4afa614d","created_at":1767783596,"kind":9734,"tags":[["relays","wss://relay.damus.io","wss://nos.lol"],["amount","2100000"],["p","ee03dfa711e49e5b0b11a2d2c337f1c6d09062294eda99ccc0f20a61ebd13d2f"],["e","6337a94666979f330b638b614fa6732732617d8cb0ceb08d2102c82bd7e17e32"]],"content":"Great photo!","id":"81e8de7503b013b5c0bae912ebb80a9498c283d0a6cfd941820dc05f2f473ae4","sig":"2e4ac26aa83af1bbf765b927dd02a5b2531c396df21c52aa3c83ed5f706a4d869a1583d3425fcdefbf4068b84a3cc5f606878c468033b718087a6eb8ae8321b4"}',
      },
    },
  },
  {
    id: 'df98837c-6a12-4b15-94f8-375c33937a4e',
    paymentType: 'send',
    status: 'completed',
    amount: BigInt(5000),
    fees: BigInt(0),
    timestamp: 1767776400,
    method: 'spark',
    details: {
      type: 'spark',
      invoiceDetails: {
        description: 'Gift to @alice',
        invoice:
          'spark1gf5h90jgvam58xnlph0vmlrmtfcplprsneuw55vw47fucev5xw0yy6tjheyxwa6rnflsmhkdl3a45uqls3cfu7822x82ly7vvk2r88jzd9etujr8wape5lcdmmxlc766wq0cguy70r49rr40j0xxt9pnnch2rxx6',
      },
    },
  },
  {
    id: '6a6c3f1f-5841-415b-b8a6-f21d3e513bae',
    paymentType: 'receive',
    status: 'completed',
    amount: BigInt(12500),
    fees: BigInt(0),
    timestamp: 1767765600,
    method: 'spark',
    details: {
      type: 'spark',
      invoiceDetails: {
        description: 'Coffee & croissant',
        invoice:
          'spark1ce8w2tue0ms76rl8y7ht73mpfs857kguqml4d62ftgv25retfp4vvnh997vhac0dplnj0t4lgas5cr60tywqdl6ka9y45x92pu45s6kxfmjjlxt7u8kslee846l5wc2vpa84j8qxlatwjj26rz4q726gdgra7hw4',
      },
    },
  },
  {
    id: 'abe077a7-b1b1-4d5b-ac14-77b6f9684698',
    paymentType: 'send',
    status: 'completed',
    amount: BigInt(10000),
    fees: BigInt(3),
    timestamp: 1767693600,
    method: 'lightning',
    details: {
      type: 'lightning',
      invoice:
        'lnbc100000n1p54ehg7pp520wf8tnu6r05d9xefwxqn6qkatjaups9ma9fexnlpu86wn4f64sqhp5p7z07znj0gzudty8ydftnkdr0gxf4wh230kyj0eak7ltqj6cegaqsp5fg0pggynxxx9h5xsm0fjez8ds8vcpp0wdfefc08zv56aq393ycwqxqzjccqzys9qrsgqdwu0g4sq83agaas6ug8x7ljzl2m8fmcqa64v65udgkj8j5vm78n88mfp0geh9h6aumv82hvf7wp8zecgyfue3ku3wvky4nczmscjk7cq98xamx',
      destinationPubkey: '028e994166d91f6ac0b4afb01d247653b7b28208a10160691d63c9360dc45482a5',
      htlcDetails: {
        paymentHash: '53dc93ae7cd0df4694d94b8c09e816eae5de0605df4a9c9a7f0f0fa74ea9d560',
        expiryTime: 1767694198,
        status: 'preimageShared',
        preimage: '57cc3b3bb96b387f07e45f418bd14a0d2d09f9405c116a7d597de0bc3854c68b',
      },
      lnurlPayInfo: {
        lnAddress: 'bob@example.com',
        comment: 'Thanks for dinner',
        domain: 'example.com',
        metadata: '[["text/plain","Pay to bob@example.com"],["text/identifier","bob@example.com"]]',
      },
    },
  },
  {
    id: 'b6f8bc08-c635-40a5-acc3-fc5f1d76875b',
    paymentType: 'receive',
    status: 'completed',
    amount: BigInt(21000),
    fees: BigInt(0),
    timestamp: 1767607200,
    method: 'lightning',
    details: {
      type: 'lightning',
      invoice:
        'lnbc210000n1p54hzumpp5t7tjr3pefzmkjuujv023yk4xqxlhagj6y098jgx4w4x5jdv6sunqhp5ehgd5deas2cat78avq5ln9kasn8x7rak9rh85nmwkguyu0utfsdqsp5crm36lwfs4g20j8n74af89jdwscnc0saphk3n08jeanqwgt0dquqxqyz5vqcqzys9qrsgqzz8vs6sx7h9dnzmwz0vtwampfmjqj9dw779dccca8z353kytqrahvewyvrwlf69u0sxgfwj9hnd55r4vep4as5sglqdltp24z79rwxspyyzqyr',
      destinationPubkey: '03619e188effcd645a7937fffe69e442f96071b60b3feaf44c3380cb63d5171383',
      htlcDetails: {
        paymentHash: '5f9721c43948b769739263d5125aa601bf7ea25a23ca7920d5754d49359a8726',
        expiryTime: 1767693595,
        status: 'preimageShared',
        preimage: 'a77d9f708befc799db20afa9a76e113689878df544da1f66a62367772fbcc63e',
      },
      lnurlReceiveMetadata: {
        senderComment: 'Happy birthday!',
      },
    },
  },
  {
    id: '45c2cb5e-be0e-4e6a-bdfa-9b68d5f988c3',
    paymentType: 'send',
    status: 'pending',
    amount: BigInt(1500),
    fees: BigInt(2),
    timestamp: 1767600000,
    method: 'lightning',
    details: {
      type: 'lightning',
      description: 'Sticker pack #42',
      invoice:
        'lnbc15000n1p54kmmzpp5xy06nl6a7rv3vprup63n5vddzztn6wwxtx7ps0d8l9t94erw5z9sdq62d6xjcmtv4ezqurpvd4jqge5xgsp59sp0jpaehek58zvgch8jj5s4j2meug4wlfd2ffpp8xh8efykajwqxqrrsscqzys9qrsgq74zz4yjjqpgvyl44dz6gq8xnp7rfgl8lag05tagxys5g4cjmtc4zmxekjhxcwmpym3ghurlwfj0ckmlu8vtvltupmq9p2l686qa7clgqwf7kye',
      destinationPubkey: '0215aae8bda900ea71126dcb59e2f63facbdbf811b4199167a345f6343dc95d292',
      htlcDetails: {
        paymentHash: '311fa9ff5df0d916047c0ea33a31ad10973d39c659bc183da7f9565ae46ea08b',
        expiryTime: 1767603570,
        status: 'waitingForPreimage',
      },
    },
  },
  {
    id: '24c8b87e-0c86-4db2-bcbd-4b6198ad0f62',
    paymentType: 'send',
    status: 'failed',
    amount: BigInt(50000),
    fees: BigInt(0),
    timestamp: 1767520800,
    method: 'lightning',
    details: {
      type: 'lightning',
      description: 'Hardware wallet',
      invoice:
        'lnbc500000n1p545wsvpp543hn9drnr6w6v6m3l6dt2k7gept2y70yprr268k4phm849u29p2sdqcfpshyerhv9ex2grhv9kxcet5sp53vt9m6fnve37qyeqxe53z4dp4frhcheldh3e0eskv6x2v0zj4lysxqzuycqzys9qrsgqm70x25l2755hwe8p4zda9td5g2d3990aau82rzj3jvr7pvwxef8zu7y0ehvyy6fl3uax7zj28cgtx04cc7efayv0xc594sn83gz3rqqpd2ynal',
      destinationPubkey: '0215aae8bda900ea71126dcb59e2f63facbdbf811b4199167a345f6343dc95d292',
      htlcDetails: {
        paymentHash: 'ac6f32b4731e9da66b71fe9ab55bc8c856a279e408c6ad1ed50df67a978a2855',
        expiryTime: 1767521680,
        status: 'returned',
      },
    },
  },
  {
    id: '9bc2f53d-fe70-45e8-bc5d-92184b7b0e01',
    paymentType: 'receive',
    status: 'completed',
    amount: BigInt(43746),
    fees: BigInt(254),
    timestamp: 1767427200,
    method: 'deposit',
    details: {
      type: 'deposit',
      txId: 'f13d75ba8491789d3825ca3802cc0b9b60ada96f5ae5123b07bc3b1d0f7c7e9a',
      vout: 1,
    },
  },
  {
    id: '71a0b382-78b2-4caa-9e32-c26615982801',
    paymentType: 'send',
    status: 'completed',
    amount: BigInt(40000),
    fees: BigInt(1840),
    timestamp: 1767355200,
    method: 'withdraw',
    details: {
      type: 'withdraw',
      txId: '8dc35b983c0ba3456c4568776dd1805b5fc60d69b867354c1adb2c3b67233e80',
    },
  },
  {
    id: '0c892d4e-31d7-474f-80bc-8645b1edb343',
    paymentType: 'send',
    status: 'completed',
    amount: BigInt(1),
    fees: BigInt(0),
    timestamp: 1767283200,
    method: 'spark',
    details: {
      type: 'spark',
      invoiceDetails: {
        description: 'Posting fee',
        invoice:
          'spark17zr6df6dpngv4hdddaxh59ss4kh57drfldvnpxh58axjdj8esv30ppax5axse5x2mkkk7nt6zcg2mt60x35lkkfsnt6r7nfxerucxghss7n2wngv6r9dmtt0f4apvy9d4a8ng60mtycf4aplf5nv37vrygfyzfdv',
      },
    },
  },
];
