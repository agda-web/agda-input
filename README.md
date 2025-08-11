# agda-input

Data source of Agda mode's input method, originally on Emacs.

# Data sources

The data is prepared from the following sources, in order:

| #  | Data source | Adapted from | File name |
| -- | ----------- | ------------ | --------- |
| 1. | Unicode data from UCD                 | [v15.1.0](https://www.unicode.org/Public/15.1.0/ucd/UnicodeData.txt) | [UnicodeData.txt](data/UnicodeData.txt)
| 2. | LaTeX IME in Emacs' Quail package     | [v29.4](https://github.com/emacs-mirror/emacs/blob/emacs-29.4/lisp/leim/quail/latin-ltx.el) | [latin-ltx.el](data/latin-ltx.el)
| 3. | Agda's homebrewed translator          | [v2.6.4.3](https://github.com/agda/agda/blob/v2.6.4.3/src/data/emacs-mode/agda-input.el) | [agda-input.el](data/agda-input.el)

The project aims to generate the exact entries Agda's input method matches against, making it easier to port this input method to other text editors.
