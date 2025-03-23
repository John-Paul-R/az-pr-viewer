import { DependencyList, useState, useEffect } from "react";

export function useAsyncMemo<T>(
    fn: () => Promise<T>,
    deps: DependencyList,
): T | undefined {
    const [value, setValue] = useState<T>();
    useEffect(() => {
        fn().then(setValue);
    }, [fn, ...deps]);
    return value;
}
