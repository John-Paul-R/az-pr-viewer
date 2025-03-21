import { createContext, useState, ReactNode, useContext } from "react";
import { PrFile, PrIndexEntry } from "./types/interfaces";

interface AppContextType {
    indexData: PrIndexEntry[];
    setIndexData: (data: PrIndexEntry[]) => void;
    archiveFile: string;
    setArchiveFile: (file: string) => void;
    files: PrFile[];
    setFiles: (files: PrFile[]) => void;
    repoPath: string;
    setRepoPath: (file: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [indexData, setIndexData] = useState<PrIndexEntry[]>([]);
    const [archiveFile, setArchiveFile] = useState<string>("");
    const [files, setFiles] = useState<PrFile[]>([]);
    const [repoPath, setRepoPath] = useState<string>([]);

    return (
        <AppContext.Provider
            value={{
                indexData,
                setIndexData,
                archiveFile,
                setArchiveFile,
                files,
                setFiles,
                repoPath,
                setRepoPath,
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
