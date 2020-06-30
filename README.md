# txt2bas and bas2txt - tooling for ZX Spectrum NextBASIC

This code is inspired by the [.txt2bas](https://gitlab.com/thesmog358/tbblue/-/blob/ef6dc4fd0f684349d16354d67d4f756db2994fdb/src/asm/dot_commands/txt2bas.asm) dot command on the ZX Spectrum Next (not that I could read the asm code!).

This project provides:

- `txt2bas` command line tool
- `bas2txt` command line tool
- NextBASIC validation
- library for BASIC and text manipulation, validation and renumbering

## Installation

[Node](https://nodejs.org/en/) and npm (included with node) are required to install and run the code.

For the command line tooling - this installs _both_ tools:

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

Note that `#autostart` directive is also supported.

### Command line options

- `-i FILENAME` - input filename
- `-o FILENAME` - output filename
- `-t` - (txt2bas only) test and validate the NextBASIC source
- `-C` - (txt2bas only) strip comments (to reduce final size)
- `-bank` - (txt2bas only) generate a BANK loadable result
- `-A #n` - (txt2bas only) set autostart line to `#n`
- `-f 3dos|tap` - set the output format
- `-H`- omit the file header (either in output or in parsing input)
- `-udg` - UDGs are used so encode with binary not utf8
- `-tokens` - (txt2bas only) show parser tokens (for debugging)
- `-h` - Show help options
- `-v` - Show current version

## Library API

Problematically using the library exposes a number of paired functions:

- `line2bas(String: line): Object<Uint8Array: basic, Number: lineNumber, Array: tokens, Number: length>` - the byte data is contained in `result.basic`
- `bas2line(Uint8Array: data): String` - expects to include the line number, line length and the line itself as bytes
- `file2bas(String: source, Object<String=3dos: format, filename=UNTITLED: String, validate=false: Boolean>): Uint8Array` - results full byte array with correct format header, if `validate` is true, will throw on token errors
- `bas2file(Uint8Array: source, String=3dos: format): String` - formatted BASIC text
- `formatText(String: line): String` - processes the line through `line2bas` then `bas2line` to result the formatted line
- `validateTxt(String: source): Arrary[String]` - parses each line collecting and returning any token errors
- `plus3DOSHeader` and `tapHeader` - file headers for the appropriate data formats
- `codes` an object lookup from NextBASIC numerical value to text value, ie. `0xf5 = 'PRINT'`
- `statements(String: source): Array[Statement]` - returns the parsed statement which include `lineNumber` and `tokens` for each line.
- `renumber(String: source, Object<start: Number, end: Number, step=10: Number, base=start: Number>)` - renumbers source lines and `GO TO` line number targets.

## Licence

- [MIT](https://rem.mit-license.org/)
