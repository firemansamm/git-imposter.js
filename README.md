# git-imposter.js
A library designed to let you serve blobs over git from within JavaScript.

### Why would you do this?
Because it's fun, and because I wanted to see how bare-bones a server can be to support a `git clone`.

### What can I do with this?
Serve anything you want over `git`. If you can get it into a string variable, you can serve it.

To get the files you serve, simply do a `git clone` on the port.

### How do I use this?

After cloning this into your `node_modules` folder as `git-imposter`, you probably need to `npm install`.

The example code below creates an imposter server listening on localhost, serving two files:
```javascript
var imposter = require("git-imposter");
imposter.set_author("test", "test@example.com"); //name, email
imposter.add("test/test.txt", "some contents\n", "100644"); //100 - blob, 644 - permissions
imposter.add("another test.txt", "hello git!\n", "100644");
imposter.serve(8080, "127.0.0.1"); //listen on 127.0.0.1, port 8080 - omit address for all interfaces
```

Doing `git clone http://127.0.0.1:8080/test.git` will pull the two files and their respective parent folders into "test".

### Not Bugs
 - Cloning without a ".git" at the end of the URL will cause git-imposter to crash. This is by design.

### Potential to-dos?
 - Allow revision with `git pull`