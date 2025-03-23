import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { autoLinkMd } from "react-markdown-autolink";

// Import Speed Highlight JS
import { highlightElement } from "@speed-highlight/core";

// https://dev.azure.com/ORGANIZATION/PROJECT/_git/REPOSITORY/pullrequest/32627
const PR_REGEX =
    /^https:?\/\/dev.azure.com\/.+?\/.+?\/_git\/.+\/pullrequest\/(\d+)/;

export function Markdown({ markdown }: { markdown: string }) {
    // Apply Speed Highlight JS to all code blocks
    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
        // This will find and highlight any code blocks that were rendered
        const codeElements = document.querySelectorAll(
            ".shj-language-container",
        );
        for (const elm of codeElements) {
            // We'll use the autodetect feature
            const code = elm.textContent || "";
            const language = elm.classList
                .toString()
                .match(/language-(\w+)/)?.[1];

            // If language is specified in class, use it, otherwise detect
            const lang = language; //|| detectLanguage(code);

            if (lang) {
                highlightElement(elm, lang as any);
            }
        }
    }, [markdown]); // Re-run when markdown changes

    markdown = autoLinkMd(markdown);

    return (
        <ReactMarkdown
            children={markdown}
            rehypePlugins={[rehypeSanitize, rehypeRaw]}
            components={{
                a(props) {
                    const { children, className, href, node, ...rest } = props;
                    const match = href ? PR_REGEX.exec(href) : "";
                    const linkTo = match?.[1]
                        ? `/pr/${match?.[1]}`
                        : href ?? "/";
                    return (
                        <Link
                            target={
                                linkTo.startsWith("http") ? "_blank" : undefined
                            }
                            to={linkTo}
                            className={className}
                            {...rest}
                        >
                            {children}
                        </Link>
                    );
                },
                code(props) {
                    const { children, className, node, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || "");

                    return match ? (
                        <div
                            {...rest}
                            // Use Speed Highlight JS class naming convention
                            className={`shj-language-container ${
                                className || ""
                            }`}
                            data-language={match[1]}
                        >
                            {String(children).replace(/\n$/, "")}
                        </div>
                    ) : (
                        <code
                            {...rest}
                            className={`shj-lang-plain ${className || ""}`}
                        >
                            {children}
                        </code>
                    );
                },
            }}
        />
    );
}
