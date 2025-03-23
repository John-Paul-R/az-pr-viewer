import {
    createContext,
    useState,
    ReactNode,
    useContext,
    useEffect,
} from "react";
import { PrFile } from "./types/interfaces";
import { invoke } from "@tauri-apps/api/core";

interface AppContextType {
    archiveFile: string;
    setArchiveFile: (file: string) => void;
    files: PrFile[];
    setFiles: (files: PrFile[]) => void;
    repoPath: string;
    setRepoPath: (file: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [archiveFile, setArchiveFile] = useState<string>("");
    const [files, setFiles] = useState<PrFile[]>([]);
    const [repoPath, setRepoPath] = useState<string>("");

    // the repo path may have been specified by the user in the cli args. We
    // need to update the UI accordingly (TODO: Probably a better way to do this
    // in tauri natively if I had to guess)
    useEffect(() => {
        invoke("get_git_repo", {}).then((path) => {
            setRepoPath((cur) => {
                if (cur) {
                    return cur;
                }
                return path as string;
            });
        });
    }, []);

    useEffect(() => {
        invoke("get_archive_path", {}).then((path) => {
            setArchiveFile((cur) => {
                if (cur?.length) {
                    // already have an archive, the cli args should not
                    // overwrite it.
                    return cur;
                }
                // an archive file was specified on initial load, handle loading
                // the data from that.
                invoke("get_pr_files").then((newIndex) =>
                    setFiles((curIndex) => {
                        if (curIndex.length === 0) {
                            return newIndex as PrFile[];
                        }
                        return curIndex;
                    }),
                );
                // update the archive file path in react state

                return path as string;
            });
        });
    }, []);

    console.log(repoPath);

    return (
        <AppContext.Provider
            value={{
                archiveFile,
                setArchiveFile,
                files,
                setFiles,
                repoPath,
                setRepoPath: (path: string) => {
                    invoke("set_git_repo", {
                        filePath: path,
                    }).then((e) => {
                        console.log(e);
                        setRepoPath(path);
                    });
                },
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
}
