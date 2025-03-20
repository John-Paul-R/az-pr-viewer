import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import './App.css';
import FileViewer from './components/FileViewer';
import PrDetails from './components/PrDetails';
import { PrFile } from './types/interfaces';
import reactLogo from "./assets/react.svg";
import "./App.css";
import "./FilesApp.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="container">
      {/* <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p> */}
      <FilesApp/>
    </main>
  );
}


function FilesApp() {
  const [directory, setDirectory] = useState<string>('');
  const [files, setFiles] = useState<PrFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Function to select directory
  async function selectDirectory() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        setDirectory(selected);
        await setDirectoryAndFetchFiles(selected);
      }
    } catch (err) {
      setError(`Failed to open directory: ${err}`);
    }
  }

  // Function to set directory in Rust backend and fetch files
  async function setDirectoryAndFetchFiles(dir: string) {
    setLoading(true);
    setError('');

    try {
      await invoke('set_directory', { newDir: dir });
      const prFiles = await invoke<PrFile[]>('get_pr_files');
      setFiles(prFiles);
    } catch (err) {
      setError(`Error: ${err}`);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  // Filter files based on search term
  const filteredFiles = files.filter(file =>
    file.pr_number.includes(searchTerm) ||
    file.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="container">
            <h1>PR JSON Viewer</h1>

            <div className="directory-section">
              <button type="button" onClick={selectDirectory}>Select Directory</button>
              <p className="selected-dir">{directory || "No directory selected"}</p>
            </div>

            {error && <div className="error">{error}</div>}

            {directory && (
              <div className="search-section">
                <input
                  type="text"
                  placeholder="Search PR files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            {loading ? (
              <p>Loading files...</p>
            ) : (
              <FileViewer files={filteredFiles} />
            )}
          </div>
        } />

        <Route path="/pr/:prNumber" element={<PrDetails />} />
        <Route path="*" element={<div>fallback!</div>}/>
      </Routes>
    </Router>
  );
}

export default App;
