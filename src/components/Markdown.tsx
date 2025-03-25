import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { autoLinkMd } from "react-markdown-autolink";
import rehypePrism from "rehype-prism-plus";
import { useTheme } from "../hooks/useTheme";
import { useEffect } from "react";

// https://dev.azure.com/ORGANIZATION/PROJECT/_git/REPOSITORY/pullrequest/32627
const PR_REGEX =
    /^https:?\/\/dev.azure.com\/.+?\/.+?\/_git\/.+\/pullrequest\/(\d+)/;

export function Markdown({ markdown }: { markdown: string }) {
    // Process markdown content (autolink urls)
    const processedMarkdown = autoLinkMd(markdown);
    const { isDark } = useTheme();

    // Dynamically import the appropriate syntax highlighting theme based on dark mode
    useEffect(() => {
        if (isDark) {
            import("../syntax-highligh-themes/tomorrow-night-dark.css");
        } else {
            import("../syntax-highligh-themes/prism.css");
        }
    }, [isDark]);

    return (
        <div className="markdown-content">
            <ReactMarkdown
                children={processedMarkdown}
                rehypePlugins={[
                    rehypeSanitize,
                    rehypeRaw,
                    [
                        rehypePrism,
                        { showLineNumbers: true, ignoreMissing: true },
                    ],
                ]}
                components={{
                    a(props) {
                        const { children, className, href, node, ...rest } =
                            props;
                        const match = href ? PR_REGEX.exec(href) : "";
                        const linkTo = match?.[1]
                            ? `/pr/${match?.[1]}`
                            : (href ?? "/");
                        return (
                            <Link
                                target={
                                    linkTo.startsWith("http")
                                        ? "_blank"
                                        : undefined
                                }
                                to={linkTo}
                                className={className}
                                {...rest}
                            >
                                {children}
                            </Link>
                        );
                    },
                    // No need for custom code component as rehypePrism handles syntax highlighting
                }}
            />
        </div>
    );
}
