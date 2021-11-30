const fs = require('fs');
const udp = require('dgram');

const dns = require('dns-js');
const axios = require('axios');
const proxyAddr = '192.168.230.132';
const proxyPort = 1446;
//const proxyAddr = '3.83.95.129';
const targetDomain = '.amazonaws.com';
const makeUDPServer = (address,port,localPort)=>{
	return new Promise( async (resolve,reject)=>{
		server = udp.createSocket('udp4');
		server.on('error',async err=>{
			if(err.errno === 'EADDRINUSE'){
				console.log(`force killing`);
				resolve({
					success:false,
					message:`Failed to bind port ${localPort}.`
				});
			} else console.error(err);
		});
		server.on('close',async()=>{
			console.log('closing udp server');
			server.unref();
		});
		server.on('message',async(msg,info)=>{
			//msg = warp(msg);
			//logger.log(msg,info.address,info.port,address,port)
			remoteClient = udp.createSocket('udp4');
			remoteClient.on('message', async (remoteMsg,remoteInfo)=>{
				remoteMsg = await warp(remoteMsg);
				//logger.log(remoteMsg,address,port,info.address,info.port)
				server.send(remoteMsg,info.port,info.address,e=>console.error(e));
			});
			remoteClient.on('close',()=>{
				remoteClient.unref();
			});
			remoteClient.send(msg,port,address,e=>console.error(e));

		});
		server.bind(localPort,()=>{
			console.log('opened udp server on', server.address());
			resolve({success:true});
		});
	});
}
const startProxy = async address=>{
	const res = await axios.post(`http://${proxyAddr}/api/createServer`,{
		address,
		port:proxyPort,
		localPort:proxyPort,
		protocol:'udp'

	});
	console.log(res.data);
}
const warp = async  m=>{
	//fs.appendFileSync('output.log',m)
	const parsed = dns.DNSPacket.parse(m);
	//console.log(parsed);
	if(parsed.question && parsed.question[0] && parsed.question[0].name){
		console.log(parsed.question[0].name);
		if(parsed.question[0].name.includes(targetDomain) && parsed.answer && parsed.answer[0]){
			const replaceAddr = parsed.answer[0].address;
			const decoded = [...m].join('.');
			const modded = decoded.replace(replaceAddr,proxyAddr);
			await startProxy(parsed.question[0].name);
			m = Buffer.from(modded.split('.'));
		}
	}
	return m;
}

const init = async()=>{
	await makeUDPServer('8.8.8.8',53,53);
}
init();
