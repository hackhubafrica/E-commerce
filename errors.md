MulterError: Unexpected field
    at wrappedFileFilter (/home/lazarus/Desktop/E_Commerce/backend/node_modules/multer/index.js:40:19)
    at Multipart.<anonymous> (/home/lazarus/Desktop/E_Commerce/backend/node_modules/multer/lib/make-middleware.js:107:7)
    at Multipart.emit (node:events:517:28)
    at HeaderParser.cb (/home/lazarus/Desktop/E_Commerce/backend/node_modules/busboy/lib/types/multipart.js:358:14)
    at HeaderParser.push (/home/lazarus/Desktop/E_Commerce/backend/node_modules/busboy/lib/types/multipart.js:162:20)
    at SBMH.ssCb [as _cb] (/home/lazarus/Desktop/E_Commerce/backend/node_modules/busboy/lib/types/multipart.js:394:37)
    at feed (/home/lazarus/Desktop/E_Commerce/backend/node_modules/streamsearch/lib/sbmh.js:248:10)
    at SBMH.push (/home/lazarus/Desktop/E_Commerce/backend/node_modules/streamsearch/lib/sbmh.js:104:16)
    at Multipart._write (/home/lazarus/Desktop/E_Commerce/backend/node_modules/busboy/lib/types/multipart.js:567:19)
    at writeOrBuffer (node:internal/streams/writable:392:12)



SyntaxError: Unexpected token n in JSON at position 5
    at JSON.parse (<anonymous>)
    at parse (/home/lazarus/Desktop/E_Commerce/backend/node_modules/body-parser/lib/types/json.js:92:19)
    at /home/lazarus/Desktop/E_Commerce/backend/node_modules/body-parser/lib/read.js:128:18
    at AsyncResource.runInAsyncScope (node:async_hooks:203:9)
    at invokeCallback (/home/lazarus/Desktop/E_Commerce/backend/node_modules/raw-body/index.js:238:16)
    at done (/home/lazarus/Desktop/E_Commerce/backend/node_modules/raw-body/index.js:227:7)
    at IncomingMessage.onEnd (/home/lazarus/Desktop/E_Commerce/backend/node_modules/raw-body/index.js:287:7)
    at IncomingMessage.emit (node:events:517:28)
    at endReadableNT (node:internal/streams/readable:1400:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:82:21)