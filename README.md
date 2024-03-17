# Apsides 

Full&#8209;stack TypeScript framework, including an ORM, UI component library, form builder and a type&#8209;safe RPC system.

See examples, packages and documentation at: https://apsides.web.app.

## Building

This repository is a central project for building the documentation page and NPM packages. Most packages are in separate repositories, but are all built, published and versioned together. The following is a list of all source repositories:

  - https://github.com/bt7s7k7/Struct
  - https://github.com/bt7s7k7/CommonTypes
  - https://github.com/bt7s7k7/Vue3GUI

To build the application, install all NPM and [UCPeM](https://github.com/bt7s7k7/UCPeM#readme) packages, then run the build script:

```bash
ucpem run build-all
```

If you want to publish the built packages, run:

```bash
ucpem run publish-all <version>
```

Then push the tag and `package.json` changes to GitHub.
