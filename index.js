const { marked } = require('marked');

marked.setOptions({ breaks: true, smartyPants: true });

class J2M {
    /**
     * Converts a Markdown string into HTML (just a wrapper to Marked's parse method).
     *
     * @static
     * @param {string} str - String to convert from Markdown to HTML
     * @returns {string} The HTML result
     */
    static md_to_html(str) {
        return marked.parse(str);
    }

    /**
     * Converts a Jira Wiki string into HTML.
     *
     * @static
     * @param {string} str - String to convert from Jira Wiki syntax to HTML
     * @returns {string} The HTML result
     */
    static jira_to_html(str) {
        return marked.parse(J2M.to_markdown(str));
    }

    /**
     * Converts a Jira Wiki string into Markdown.
     *
     * @static
     * @param {string} str - Jira Wiki string to convert to Markdown
     * @returns {string} The Markdown result
     */
    static to_markdown(str) {
        return (
            str
                // Un-Ordered Lists
                .replace(/^[ \t]*(\*+)\s+/gm, (match, stars) => {
                    return `${Array(stars.length).join('  ')}* `;
                })
                // Ordered lists
                .replace(/^[ \t]*(#+)\s+/gm, (match, nums) => {
                    return `${Array(nums.length).join('   ')}1. `;
                })
                // Headers 1-6
                .replace(/^h([0-6])\.(.*)$/gm, (match, level, content) => {
                    return Array(parseInt(level, 10) + 1).join('#') + content;
                })
                // Bold
                .replace(/\*(\S.*)\*/g, '**$1**')
                // Italic
                .replace(/_(\S.*)_/g, '*$1*')
                // Monospaced text
                .replace(/\{\{([^}]+)\}\}/g, '`$1`')
                // Citations (buggy)
                // .replace(/\?\?((?:.[^?]|[^?].)+)\?\?/g, '<cite>$1</cite>')
                // Inserts
                .replace(/\+([^+]*)\+/g, '<ins>$1</ins>')
                // Superscript
                .replace(/\^([^^]*)\^/g, '<sup>$1</sup>')
                // Subscript
                .replace(/~([^~]*)~/g, '<sub>$1</sub>')
                // Strikethrough
                .replace(/(\s+)-(\S+.*?\S)-(\s+)/g, '$1~~$2~~$3')
                // Code Block
                .replace(
                    /\{code(:([a-z]+))?([:|]?(title|borderStyle|borderColor|borderWidth|bgColor|titleBGColor)=.+?)*\}([^]*?)\n?\{code\}/gm,
                    '```$2$5\n```'
                )
                // Pre-formatted text
                .replace(/{noformat}/g, '```')
                // Un-named Links
                .replace(/\[([^|]+?)\]/g, '<$1>')
                // Images
                .replace(/!(.+)!/g, '![]($1)')
                // Named Links
                .replace(/\[(.+?)\|(.+?)\]/g, '[$1]($2)')
                // Single Paragraph Blockquote
                .replace(/^bq\.\s+/gm, '> ')
                // Remove color: unsupported in md
                .replace(/\{color:[^}]+\}([^]*?)\{color\}/gm, '$1')
                // panel into table
                .replace(/\{panel:title=([^}]*)\}\n?([^]*?)\n?\{panel\}/gm, '\n| $1 |\n| --- |\n| $2 |')
                // table header
                .replace(/^[ \t]*((?:\|\|.*?)+\|\|)[ \t]*$/gm, (match, headers) => {
                    const singleBarred = headers.replace(/\|\|/g, '|');
                    return `\n${singleBarred}\n${singleBarred.replace(/\|[^|]+/g, '| --- ')}`;
                })
                // remove leading-space of table headers and rows
                .replace(/^[ \t]*\|/gm, '|')
        );
        // // remove unterminated inserts across table cells
        // .replace(/\|([^<]*)<ins>(?![^|]*<\/ins>)([^|]*)\|/g, (_, preceding, following) => {
        //     return `|${preceding}+${following}|`;
        // })
        // // remove unopened inserts across table cells
        // .replace(/\|(?<![^|]*<ins>)([^<]*)<\/ins>([^|]*)\|/g, (_, preceding, following) => {
        //     return `|${preceding}+${following}|`;
        // });
    }

    /**
     * Converts a Markdown string into Jira Wiki syntax.
     *
     * @static
     * @param {string} str - Markdown string to convert to Jira Wiki syntax
     * @returns {string} The Jira Wiki syntax result
     */
    static to_jira(str) {
        const map = {
            // cite: '??',
            del: '-',
            ins: '+',
            sup: '^',
            sub: '~',
        };

        return (
            str
                // Tables
                .replace(
                    /^\n((?:\|.*?)+\|)[ \t]*\n((?:\|\s*?-{3,}\s*?)+\|)[ \t]*\n((?:(?:\|.*?)+\|[ \t]*\n)*)$/gm,
                    (match, headerLine, separatorLine, rowstr) => {
                        const headers = headerLine.match(/[^|]+(?=\|)/g);
                        const separators = separatorLine.match(/[^|]+(?=\|)/g);
                        if (headers.length !== separators.length) return match;

                        const rows = rowstr.split('\n');
                        if (rows.length === 2 && headers.length === 1)
                            // Panel
                            return `{panel:title=${headers[0].trim()}}\n${rowstr
                                .replace(/^\|(.*)[ \t]*\|/, '$1')
                                .trim()}\n{panel}\n`;

                        return `||${headers.join('||')}||\n${rowstr}`;
                    }
                )
                // Bold, Italic, and Combined (bold+italic)
                .replace(/([*_]+)(\S.*?)\1/g, (match, wrapper, content) => {
                    switch (wrapper.length) {
                        case 1:
                            return `_${content}_`;
                        case 2:
                            return `*${content}*`;
                        case 3:
                            return `_*${content}*_`;
                        default:
                            return wrapper + content + wrapper;
                    }
                })
                // All Headers (# format)
                .replace(/^([#]+)(.*?)$/gm, (match, level, content) => {
                    return `h${level.length}.${content}`;
                })
                // Headers (H1 and H2 underlines)
                .replace(/^(.*?)\n([=-]+)$/gm, (match, content, level) => {
                    return `h${level[0] === '=' ? 1 : 2}. ${content}`;
                })
                // Ordered lists
                .replace(/^([ \t]*)\d+\.\s+/gm, (match, spaces) => {
                    return `${Array(Math.floor(spaces.length / 3) + 1)
                        .fill('#')
                        .join('')} `;
                })
                // Un-Ordered Lists (* or - or +)
                .replace(/^([ \t]*)[\*\-\+]\s+/gm, (match, spaces) => {
                    const len = spaces.length % 2 !== 0 ? spaces.length - 1 : spaces.length;
                    return `${Array(Math.floor(len / 2 + 1))
                        .fill('*')
                        .join('')} `;
                })
                // Nested Lists
                .to_jira_nested_list()
                // Citations, Inserts, Subscripts, Superscripts, and Strikethroughs
                .replace(new RegExp(`<(${Object.keys(map).join('|')})>(.*?)</\\1>`, 'g'), (match, from, content) => {
                    const to = map[from];
                    return to + content + to;
                })
                // Other kind of strikethrough
                .replace(/(\s+)~~(.*?)~~(\s+)/g, '$1-$2-$3')
                // Named/Un-Named Code Block
                .replace(/```(.+\n)?((?:.|\n)*?)```/g, (match, synt, content) => {
                    let code = '{code}';
                    if (synt) {
                        code = `{code:${synt.replace(/\n/g, '')}}\n`;
                    }
                    return `${code}${content}{code}`;
                })
                // Inline-Preformatted Text
                .replace(/`([^`]+)`/g, '{{$1}}')
                // Images
                .replace(/!\[[^\]]*\]\(([^)]+)\)/g, '!$1!')
                // Named Link
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1|$2]')
                // Un-Named Link
                .replace(/<([^>]+)>/g, '[$1]')
                // Single Paragraph Blockquote
                .replace(/^>/gm, 'bq.')
        );
    }
}

String.prototype.to_jira_nested_list = function () {
    const lineFormatter = function (str) {
        const arr = str.split('\n');

        let buffer = [];
        let indentDistance;

        arr.forEach((line, index) => {
            if (!(line.startsWith('#') || line.startsWith('*'))) {
                buffer = [];
            } else {
                arr[index] = line.replace(/^([\*#]+\s)/g, (match) => {
                    const spaces = match.replace(/[\*#]*/, '');
                    match = match.trim();

                    let result = '';
                    let leftChars = match;
                    // indent from 0
                    const indent = Math.floor(match.length / 2);

                    // set indentDistance (can be 1 or 2)
                    if (indent > 0 && !indentDistance) {
                        indentDistance = match.length - buffer.length;
                    }

                    const indentRange = indentDistance ?? 1;

                    // remove others indents
                    buffer = buffer.slice(0, indent);
                    // add new char to buffer
                    buffer[indent] = line.charAt(0);
                    // define indentRange

                    // apply transformation
                    for (let i = 0; i < indent; i++) {
                        if (buffer[i]) {
                            result += buffer[i];
                        }
                        leftChars = leftChars.slice(indentRange);
                    }
                    // add remaining chars
                    result += leftChars;

                    return result + spaces;
                });
            }
        });
        return arr.join('\n');
    };

    return this.split('\n\n')
        .map((block) => lineFormatter(block))
        .join('\n\n');
};

module.exports = J2M;
