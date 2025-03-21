import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

// https://dev.azure.com/ORGANIZATION/PROJECT/_git/REPOSITORY/pullrequest/32627
const PR_REGEX =
    /^https:?\/\/dev.azure.com\/.+?\/.+?\/_git\/.+\/pullrequest\/(\d+)/;

export function Markdown({ markdown }: { markdown: string }) {
    return (
        <ReactMarkdown
            children={markdown}
            rehypePlugins={[rehypeSanitize, rehypeRaw]}
            components={{
                a(props) {
                    const { children, className, href, ...rest } = props;
                    const match = href ? PR_REGEX.exec(href) : "";

                    return (
                        <Link
                            to={match?.[1] ? `/pr/${match?.[1]}` : href ?? "/"}
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
                        <SyntaxHighlighter
                            {...rest}
                            // @ts-expect-error I will just assume this ref incompatability is _fine_
                            ref={rest.ref}
                            PreTag="div"
                            children={String(children).replace(/\n$/, "")}
                            language={match[1]}
                            style={oneLight}
                        />
                    ) : (
                        <code {...rest} className={className}>
                            {children}
                        </code>
                    );
                },
            }}
        />
    );
}
