var git = require("./git-imposter");

git.add("test/test.txt", "contents as follows\n", "100644");
git.add("things/another test.txt", "some contents?\n", "100644");
git.serve(8080, "127.0.0.1");