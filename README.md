# txt2bas and bas2txt - tooling for ZX Spectrum NextBASIC

This code is inspired by the [.txt2bas](https://gitlab.com/thesmog358/tbblue/-/blob/ef6dc4fd0f684349d16354d67d4f756db2994fdb/src/asm/dot_commands/txt2bas.asm) dot command on the ZX Spectrum Next (not that I could read the asm code!).

This project provides 3 things:

- `txt2bas` command line tool
- `bas2txt` command line tool
- library for BASIC and text manipulation

**Important to note** there is no error checking in the BASIC source you provide as text. This code is simply converts back and forth and performs no error checking (as yet).

## Installation

[Node](https://nodejs.org/en/) and npm (included with node) are required to install and run the code.

For the command line tooling - this installs *both* tools:

```
npm install --global txt2bas
```

## Command line usage

Command line arguments are the same for both `txt2bas` and `bas2txt`:

```
txt2bas -i source.txt -o result.bas # generate a 3dos basic file
bas2txt -i source.bas -o result.txt # generates plain text
```

Omitting `-o` will print to `stdout`.

By default the generated file is a +3DOS format unless the output or input filename ends in `.tap` or using the format option `-f tap`:

```
txt2bas -i source.txt -o result.tap # generates a tap file
```

The command line can also read from `stdin` though this works best on `txt2bas` and not recommended for `bas2txt`.

## Library API

Problematically using the library exposes a number of paired functions:

- `line2bas(String: line): Object<Uint8Array: basic, Number: lineNumber, Array: tokens, Number: length>` - the byte data is contained in `result.basic`
- `bas2line(Uint8Array: data): String` - expects to include the line number, line length and the line itself as bytes
- `file2bas(String: source, String=3dos: format, filename=UNTITLED: String): Uint8Array` - results full byte array with correct format header
- `bas2file(Uint8Array: source, String=3dos: format): String` - formatted BASIC text
- `formatText(String: line): String` - processes the line through `line2bas` then `bas2line` to result the formatted line

## TODO

- Support `#autostart`
- Support autostart on command line

## Licence

- [MIT](https://rem.mit-license.org/)
