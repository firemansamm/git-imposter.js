var net = require("net");
var util = require("util");
var crypto = require('crypto');
var zlib = require("pako");

//tree sha1, unixtime, unixtime
var DEFAULT_COMMIT = "tree %s\nauthor %s <%s> %s +0800\ncommitter %s <%s> %s +0800\n\npackaged by git-imposter-0.0.1\n",
//commit sha1
	GET_PACK_RESPONSE_1 = "000000b4%s HEAD\0multi_ack thin-pack shallow no-progress include-tag multi_ack_detailed no-done symref=HEAD:refs/heads/master agent=imposter/0.0.1\n",
	GET_PACK_RESPONSE_2 = "003f%s refs/heads/master\n";
	
var current_tree = [], current_blobs = [], current_tree_object, current_commit_object;
var author_name = "git-imposter", author_email = "git-imposter@mntco.de";

exports.set_author = function(name, email) {
	author_name = name; author_email = email;
};
	
exports.add = function (name, thing, mode){
	//for now assume thing is a string
	var blob = gen_blob(thing);
	current_tree.push({mode: mode, path: name, obj: blob.id, ha: blob.ha});
};

exports.serve = function(port, hostname){
	gen_tree();
	gen_commit();
	var server = net.createServer(function(socket) {
		socket.on("data", function(data){
			try{
				var fc = /GET \/([a-zA-Z0-9]+)\.git\/info\/refs\?service=git-upload-pack/gmi.exec(data.toString()), 
					nc = /POST \/([a-zA-Z0-9]+)\.git\/git-upload-pack/gmi.exec(data.toString());
				if(fc != null) {
					socket.write("HTTP/1.1 200 OK\r\n");
					socket.write("Content-Type: application/x-git-upload-pack-advertisement\r\n");
					socket.write("Cache-Control: no-cache\r\n");
					socket.write("\r\n");
					socket.write("001e# service=git-upload-pack\n");
					socket.write(util.format(GET_PACK_RESPONSE_1, current_commit_object.id));
					socket.write(util.format(GET_PACK_RESPONSE_2, current_commit_object.id));
					socket.write("0000");
					socket.end();
				} else if(nc != null) {
					socket.write("HTTP/1.1 200 OK\r\n");
					socket.write("Content-Type: application/x-git-upload-pack-result\r\n");
					socket.write("Cache-Control: no-cache\r\n");
					socket.write("\r\n");
					socket.write("0008NAK\n");
					serve_pack(socket);
					//socket.write(current_pack);
					socket.end();
				} else {
					socket.write("HTTP/1.1 404 Not Found\r\n");
					socket.write("Content-Type: text/html\r\n");
					socket.write("Content-Length: 5\r\n");
					socket.write("\r\n");
					socket.write("oops!\r\n");
					socket.write("\r\n");
					socket.end();
				}
			} catch (err) {
				console.log("socket was closed");
			}
		});
		
	});
	server.listen(port, hostname);
};

function buf2str(buf, len){
	var ret = "";
	for(var i=0;i<len;i++){
		ret += String.fromCharCode(buf[i]);
	}
	return ret;
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length);
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
	bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function serve_object(sock, sha, obj, type){
	var sz = obj.len;
	var xb = Buffer(1);
	var f = false;
	do {
		var cb = 0;
		var cmx = 127;
		if (!f) cmx = 15;
		if (sz > cmx) cb = 128;
		if (!f) {
			cb |= (type << 4);
			cb |= (sz & 15);
			sz >>= 4;
		} else {
			cb |= (sz & 127);
			sz >>= 7;
		}
		f = true;
		xb.writeUInt8(cb, 0);
		sha.update(xb);
		sock.write(xb);
	} while (sz > 0);
	for(var i = 0; i < obj.val.length; i++) {
		xb.writeUInt8(obj.val[i], 0);
		sock.write(xb);
		sha.update(xb);
	}
}

function serve_pack(sock){
	var sha = crypto.createHash('sha1');
	var count = current_blobs.length + 2; //1 tree and 1 commit object
	sock.write("PACK"); sha.update("PACK");
	sock.write("\0\0\0\2"); sha.update("\0\0\0\2");
	var xb = Buffer(4);
	xb.writeUInt32BE(count, 0); 
	sock.write(xb); sha.update(xb);
	for(var i = 0; i < current_blobs.length; i++) {
		serve_object(sock, sha, current_blobs[i], 3);
	}
	serve_object(sock, sha, current_tree_object, 2);
	serve_object(sock, sha, current_commit_object, 1);
	sock.write(sha.digest());
}

function gen_commit(){
	var commit = util.format(DEFAULT_COMMIT, current_tree_object.id,  author_name, author_email, Math.round(+ new Date() / 1000).toString(), author_name, author_email, Math.round(+ new Date() / 1000).toString());
	var ret = gen_compressed_object(commit, "commit");
	current_commit_object = ret;
	return ret;
}

function gen_tree(){
	var cont = "";
	for(var i=0;i<current_tree.length;i++){
		var thing = current_tree[i];
		cont += thing.mode;
		cont += " ";
		cont += thing.path;
		cont += "\0";
		cont += buf2str(thing.ha, 20);
	}
	var ret = gen_compressed_object(cont, "tree");
	current_tree_object = ret;
	return ret;
}

function gen_blob(thing){
	var ret = gen_compressed_object(thing, "blob");
	current_blobs.push(ret);
	return ret;
}

function gen_compressed_object(thing, type){
	var ret = {
		id: "",
		val: "",
		ha: "",
		len: 0
	};
	ret.len = thing.length;
	var x = util.format("%s %d\0", type, thing.length) + thing;
	var sha = crypto.createHash('sha1');
	sha.update(x);
	ret.ha = sha.digest();
	ret.id = ret.ha.toString("hex");
	//console.log("generated %s %s len %d", type, ret.id, thing.length);
	ret.val = zlib.deflate(str2ab(thing), {level:6});
	return ret;
}
