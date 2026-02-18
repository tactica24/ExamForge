const fs = require("node:fs");

function normalizeReadlinkError(error) {
  if (!error || error.code !== "EISDIR") return error;

  // Node 24 on Windows can surface EISDIR for readlink on regular files.
  // Webpack expects EINVAL in this branch and treats it as "not a symlink".
  const next = new Error(error.message);
  next.code = "EINVAL";
  next.errno = error.errno;
  next.path = error.path;
  next.syscall = error.syscall;
  return next;
}

const readlink = fs.readlink.bind(fs);
fs.readlink = function patchedReadlink(path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }

  return readlink(path, options, (error, link) => {
    callback(normalizeReadlinkError(error), link);
  });
};

const readlinkSync = fs.readlinkSync.bind(fs);
fs.readlinkSync = function patchedReadlinkSync(path, options) {
  try {
    return readlinkSync(path, options);
  } catch (error) {
    throw normalizeReadlinkError(error);
  }
};

if (fs.promises && typeof fs.promises.readlink === "function") {
  const readlinkPromise = fs.promises.readlink.bind(fs.promises);
  fs.promises.readlink = async function patchedReadlinkPromise(path, options) {
    try {
      return await readlinkPromise(path, options);
    } catch (error) {
      throw normalizeReadlinkError(error);
    }
  };
}
