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

console.log(
    J2M.to_jira(
        '#### Enable Seamless Export to Jira Functionality for Improved Workflow Efficiency\n\n#### Narrative\n\nAs a developer working on a SaaS application, I want to implement "export to Jira logic" so that users can seamlessly transfer information between our platform and Jira, facilitating efficient collaboration and workflow management.\n\n#### Architecture\n\nTo create the "export to Jira logic" for your SaaS application, you will need to consider the main components of the system and their relationships, as well as the integration with Jira through specific interfaces or APIs.\n\nMain Components of the System:\n\n1.  User Interface: The interface where users trigger the export to Jira action.\n2.  Export Module: A module responsible for formatting and sending data to Jira.\n3.  Jira API Integration: The component that communicates with Jira\'s API to create issues or update data.\n\nRelationships:\n\n*   The User Interface component interacts with the Export Module to initiate the export process.\n*   The Export Module formats the data and sends it to the Jira API Integration component.\n*   The Jira API Integration component communicates with Jira via APIs to create or update data in Jira.\n\nSystem Integration with Jira: For integrating your SaaS application with Jira, you will need to use Jira\'s REST API. This API allows you to interact with various aspects of Jira, such as creating issues, updating issue details, and more. By utilizing the Jira REST API, you can seamlessly push data from your application to Jira and maintain synchronized workflows.\n\nCommon Examples of Specific APIs Used in Best World Solutions:\n\n1.  Jira REST API: This API enables you to interact with Jira programmatically, allowing you to create, read, update, and delete issues, projects, users, and more. It provides endpoints for various Jira functionalities, offering flexibility in integrating external systems with Jira.\n\nBy implementing the "export to Jira logic" in your SaaS application with a well-defined architecture and utilizing the Jira REST API for seamless integration, you can enhance user experience and streamline workflow processes.\n\n#### Acceptance criteria\n\n1.  **Acceptance Criteria:**\n    *   The user interface includes a visible and intuitive option/button to trigger the "export to Jira" action.\n        *   The button should be prominently displayed on the screen, easily identifiable to users.\n    *   Upon selecting the export option, the system gathers relevant data to be exported to Jira effectively.\n        *   The system should fetch data accurately based on user selections or parameters.\n    *   The exported data is formatted correctly according to Jira\'s requirements for seamless integration.\n        *   Formatting should adhere to Jira\'s specifications without any data loss or truncation.\n    *   The system connects to Jira using the Jira API Integration component to successfully transfer the data.\n        *   The integration should establish a secure connection with Jira\'s API for data transfer.\n    *   The exported data is sent to Jira without any loss or corruption of information.\n        *   Data integrity should be maintained throughout the transfer process.\n    *   Users receive a confirmation message or notification confirming the successful export to Jira.\n        *   Users should be notified of the export status, including success or failure, with clear messaging.\n2.  **Additional Criteria:**\n    *   The system should handle any errors or exceptions that may occur during the export process, providing clear and actionable error messages for users.\n        *   All possible error scenarios should be anticipated and appropriate error handling mechanisms implemented.\n    *   Data privacy and security measures should be implemented to ensure the protection of sensitive information during the export process.\n        *   Data encryption and secure protocols should be utilized to safeguard user data during transfer.\n    *   Proper documentation and guidelines should be provided for users on how to use the "export to Jira" feature effectively.\n        *   User-friendly documentation should guide users on how to initiate and troubleshoot the export process.\n    *   Performance tests should be conducted to verify the efficiency and speed of the export process, ensuring a seamless user experience.\n        *   Load testing should be performed to ensure the system can handle varied data volumes without performance degradation.\n    *   User feedback should be collected and analyzed to identify any areas of improvement for the "export to Jira" functionality.\n        *   User surveys or feedback mechanisms should be in place to gather insights for enhancing the export feature.'
    )
);

module.exports = J2M;
