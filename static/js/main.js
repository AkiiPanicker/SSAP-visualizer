document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBALS ---
    let network = null;
    let nodes = new vis.DataSet();
    let edges = new vis.DataSet();
    // CRITICAL CHANGE: Start and End nodes are stored as strings to prevent type mismatches.
    let startNode = null;
    let endNode = null;
    let editMode = 'none'; // 'none', 'addNode', 'addEdge'
    let isAnimating = false;

    const container = document.getElementById('mynetwork');
    const logBox = document.getElementById('log');

    const EXPLANATIONS = {
        dijkstra: `
            <h3>Dijkstra's Algorithm</h3>
            <p>Dijkstra's finds the shortest path between nodes in a graph with non-negative edge weights. It explores outward from the start node, always visiting the closest unvisited node.</p>
            <table class="efficiency-table">
                <tr><th>Time Complexity</th><td>O(E log V)</td></tr>
                <tr><th>Space Complexity</th><td>O(V)</td></tr>
                <tr><th>Notes</th><td>Greedy. Doesn't work with negative weights.</td></tr>
            </table>`,
        a_star: `
            <h3>A* Search</h3>
            <p>A* is a "smarter" version of Dijkstra's. It uses a heuristic (an educated guess, here the straight-line distance to the end) to prioritize nodes that seem to be on a better path.</p>
            <table class="efficiency-table">
                <tr><th>Time Complexity</th><td>O(E log V)</td></tr>
                <tr><th>Space Complexity</th><td>O(V)</td></tr>
                <tr><th>Notes</th><td>Very efficient with a good heuristic. Complete and optimal.</td></tr>
            </table>`,
        bellman_ford: `
            <h3>Bellman-Ford Algorithm</h3>
            <p>Bellman-Ford is slower but more versatile than Dijkstra's. It can handle graphs with negative edge weights. It works by "relaxing" all edges V-1 times.</p>
            <table class="efficiency-table">
                <tr><th>Time Complexity</th><td>O(V * E)</td></tr>
                <tr><th>Space Complexity</th><td>O(V)</td></tr>
                <tr><th>Notes</th><td>Can detect negative weight cycles, which create infinitely short paths.</td></tr>
            </table>`,
        bidirectional: `
            <h3>Bidirectional Dijkstra</h3>
            <p>This algorithm runs two searches simultaneously: one forward from the start, and one backward from the end. It stops when the two searches meet. It explores a much smaller area than a standard Dijkstra search.</p>
            <table class="efficiency-table">
                <tr><th>Time Complexity</th><td>O(E log V)</td></tr>
                <tr><th>Space Complexity</th><td>O(V)</td></tr>
                <tr><th>Notes</th><td>Extremely fast for finding a single path in large graphs.</td></tr>
            </table>`
    };

    // --- UTILITY FUNCTIONS ---
    const logMessage = (msg, clear = false) => {
        if (clear) logBox.innerHTML = '';
        const p = document.createElement('p');
        p.textContent = `> ${msg}`;
        logBox.appendChild(p);
        logBox.scrollTop = logBox.scrollHeight;
    };
    
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const getAnimationSpeed = () => 1050 - document.getElementById('speed-slider').value;

    const setControlsEnabled = (enabled) => {
        document.querySelectorAll('#controls-panel button, #controls-panel select').forEach(el => {
            el.disabled = !enabled;
        });
        isAnimating = !enabled;
    };
    
    const resetVisuals = () => {
        const allNodes = nodes.get({ fields: ['id'] });
        const allEdges = edges.get({ fields: ['id'] });
        
        const updatedNodes = allNodes.map(node => ({
            id: node.id,
            // Use string comparison for safety
            color: (String(node.id) === startNode) ? 'var(--start-node-color)' : (String(node.id) === endNode) ? 'var(--end-node-color)' : '#6e6efc',
            shapeProperties: { borderDashes: false }
        }));
        
        const updatedEdges = allEdges.map(edge => ({ id: edge.id, color: '#ffffff', width: 1 }));
        
        nodes.update(updatedNodes);
        edges.update(updatedEdges);
        clearTables();
    };

    const clearTables = () => {
        document.querySelector('#iterative-table thead').innerHTML = '';
        document.querySelector('#iterative-table tbody').innerHTML = '';
        document.getElementById('final-path').textContent = 'Path: -';
        document.getElementById('final-cost').textContent = 'Total Cost: -';
        document.getElementById('nodes-visited').textContent = 'Nodes Visited: -';
    }

    const setEditMode = (mode, resetEdgeCreation = true) => {
        if(resetEdgeCreation) window.edgeCreationNodes = []; // Reset if mode changes
        editMode = mode;
        const statusEl = document.querySelector('.edit-mode-status');
        if (mode === 'addNode') statusEl.textContent = 'Click on the canvas to add a node.';
        else if (mode === 'addEdge') statusEl.textContent = 'Click two nodes to connect them.';
        else statusEl.textContent = '';
    };
    
    const updateExplanation = () => {
        const algo = document.getElementById('algo-select').value;
        document.getElementById('explanation-container').innerHTML = EXPLANATIONS[algo];
    };


    // --- VIS.JS NETWORK INITIALIZATION ---
    function initializeNetwork() {
        const data = { nodes, edges };
        const options = {
            nodes: {
                shape: 'dot', size: 20, font: { size: 14, color: '#ffffff' },
                borderWidth: 2, color: { border: '#ffffff', background: '#6e6efc' }
            },
            edges: {
                width: 1, font: { size: 14, align: 'middle', color: '#ffffff', strokeWidth: 3, strokeColor: '#27293d' },
                arrows: { to: { enabled: true, scaleFactor: 0.5 } },
                color: '#ffffff', smooth: false
            },
            physics: { enabled: false },
            interaction: { dragNodes: true, dragView: true, zoomView: true },
            manipulation: { enabled: false },
        };
        network = new vis.Network(container, data, options);
        setupNetworkListeners();
        generateRandomGraph();
    }
    
    // --- EVENT LISTENERS ---
    
    function setupNetworkListeners() {
        window.edgeCreationNodes = [];

        network.on('click', (params) => {
            const nodeId = params.nodes[0];
            const nodeEditor = document.getElementById('node-editor');
            if (editMode === 'addNode') {
                const { pointer } = params;
                // Robust way to get a new unique ID
                const existingIds = nodes.getIds().map(id => parseInt(id)).filter(id => !isNaN(id));
                const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
                nodes.add({ id: newId, label: String(newId), x: pointer.canvas.x, y: pointer.canvas.y });
                logMessage(`Added node ${newId}.`);

            } else if (editMode === 'addEdge' && nodeId) {
                const sNodeId = String(nodeId); // Ensure string
                window.edgeCreationNodes.push(sNodeId);
                logMessage(`Node ${sNodeId} selected. Select a second node.`);
                
                if (window.edgeCreationNodes.length === 2) {
                    const [from, to] = window.edgeCreationNodes;
                    if(from !== to) {
                        const weight = prompt('Enter edge weight (e.g., 5):', '5');
                        if (weight && !isNaN(parseInt(weight)) && parseInt(weight) > 0) {
                            edges.add({ from: from, to: to, label: String(weight) });
                            logMessage(`Edge created between ${from} and ${to} with weight ${weight}.`);
                        } else {
                            logMessage(`Invalid weight. Edge not created.`, true);
                        }
                    } else {
                        logMessage('Cannot connect a node to itself.', true);
                    }
                    setEditMode('none', true); // Reset mode and nodes list
                }
            } else {
                 if (nodeId) {
                    nodeEditor.style.display = 'block';
                    document.getElementById('selected-node-id').innerText = nodeId;
                } else {
                    nodeEditor.style.display = 'none';
                    setEditMode('none');
                }
            }
        });
    }

    document.getElementById('algo-select').addEventListener('change', updateExplanation);
    
    // --- Button Listeners ---
    document.getElementById('random-btn').addEventListener('click', generateRandomGraph);
    document.getElementById('clear-btn').addEventListener('click', () => {
        nodes.clear();
        edges.clear();
        startNode = null;
        endNode = null;
        clearTables();
        document.getElementById('comparison-table').querySelector('tbody').innerHTML = '';
        logMessage("Canvas cleared.", true);
    });
    
    document.getElementById('add-node-btn').addEventListener('click', () => setEditMode('addNode'));
    document.getElementById('add-edge-btn').addEventListener('click', () => setEditMode('addEdge'));

    document.getElementById('set-start-btn').addEventListener('click', () => {
        const nodeId = document.getElementById('selected-node-id').innerText;
        if (nodeId) {
            // Decolorize old start node if it exists and isn't the new start/end node
            if (startNode && startNode !== nodeId && startNode !== endNode) {
                nodes.update({ id: startNode, color: '#6e6efc' });
            }
            // Set new start node (as a string)
            startNode = nodeId;
            nodes.update({ id: startNode, color: 'var(--start-node-color)' });
            logMessage(`Node ${startNode} set as START.`);
        }
    });

    document.getElementById('set-end-btn').addEventListener('click', () => {
        const nodeId = document.getElementById('selected-node-id').innerText;
        if (nodeId) {
             // Decolorize old end node if it exists and isn't the new start/end node
             if (endNode && endNode !== nodeId && endNode !== startNode) {
                nodes.update({ id: endNode, color: '#6e6efc' });
            }
            // Set new end node (as a string)
            endNode = nodeId;
            nodes.update({ id: endNode, color: 'var(--end-node-color)' });
            logMessage(`Node ${endNode} set as END.`);
        }
    });

    document.getElementById('delete-node-btn').addEventListener('click', () => {
        const nodeId = document.getElementById('selected-node-id').innerText;
        if (nodeId) {
            nodes.remove(nodeId);
            // Check if deleted node was the start or end node
            if (startNode === nodeId) startNode = null;
            if (endNode === nodeId) endNode = null;
            document.getElementById('node-editor').style.display = 'none';
            logMessage(`Node ${nodeId} and its edges deleted.`);
        }
    });

    document.getElementById('start-btn').addEventListener('click', runAlgorithm);
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (!isAnimating) resetVisuals();
    });

    // Tab functionality
    document.querySelectorAll('.tab-link').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-link, .tab-content').forEach(el => el.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
        });
    });

    // --- GRAPH GENERATION ---
    function generateRandomGraph() {
        nodes.clear();
        edges.clear();
        startNode = null;
        endNode = null;

        const numNodes = 12;
        const newNodes = [];
        for (let i = 1; i <= numNodes; i++) {
            newNodes.push({
                id: i, label: String(i), x: Math.random() * 800 - 400, y: Math.random() * 600 - 300
            });
        }
        nodes.add(newNodes);

        const newEdges = [];
        for (let i = 1; i <= numNodes; i++) {
            for (let j = i + 1; j <= numNodes; j++) {
                if (Math.random() > 0.5) {
                    newEdges.push({
                        from: i, to: j, label: String(Math.floor(Math.random() * 20) + 1)
                    });
                }
            }
        }
        edges.add(newEdges);
        logMessage("Generated a new random graph.", true);
        clearTables();
    }
    
    // --- ALGORITHM EXECUTION & ANIMATION ---
    function setupIterativeTable(algo) {
        const thead = document.querySelector('#iterative-table thead');
        const tbody = document.querySelector('#iterative-table tbody');
        thead.innerHTML = '';
        tbody.innerHTML = '';
        
        let headers = ['Node', 'Cost', 'Previous'];
        if (algo === 'a_star') headers = ['Node', 'g(n)', 'h(n)', 'f(n)', 'Previous'];

        thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        tbody.innerHTML = nodes.get().map(node => 
            `<tr id="row-${node.id}">
                <td class="node-id">${node.id}</td>
                ${headers.slice(1).map(() => '<td>-</td>').join('')}
            </tr>`
        ).join('');
    }

    async function runAlgorithm() {
        if (!startNode || !endNode) {
            alert('Please select a start and an end node first.');
            return;
        }

        resetVisuals();
        setControlsEnabled(false);
        
        const algo = document.getElementById('algo-select').value;
        logMessage(`Starting ${algo.replace('_',' ')}...`, true);

        const graphData = {
            nodes: nodes.get({fields: ['id', 'label', 'x', 'y']}),
            edges: edges.get()
        };
        
        setupIterativeTable(algo);

        try {
            const response = await fetch('/api/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    graph: graphData,
                    startNode: startNode, // This is now correctly a string
                    endNode: endNode,     // This is now correctly a string
                    algorithm: algo
                })
            });

            if (!response.ok) throw new Error((await response.json()).error || 'API Error');

            const steps = await response.json();
            await animateSteps(steps, algo);

        } catch (error) {
            logMessage(`Error: ${error.message}`);
            alert(`An error occurred: ${error.message}`);
        } finally {
            setControlsEnabled(true);
        }
    }

    async function animateSteps(steps, algo) {
        for (const step of steps) {
            if (step.message) logMessage(step.message);
            const speed = getAnimationSpeed();
            updateTable(step, algo);
            
            switch(step.type) {
                case 'visit':
                    nodes.update({
                        id: step.node,
                        color: { background: (step.direction === 'bwd') ? '#ff8c00' : 'var(--visited-color)' }
                    });
                    break;
                case 'check_edge':
                    // CORRECTED: This logic is now robust against string/number types.
                    const edgeId = edges.getIds({
                        filter: e => (String(e.from) === step.from && String(e.to) === step.to) || 
                                     (String(e.to) === step.from && String(e.from) === step.to)
                    })[0];
                    if (edgeId) {
                        edges.update({id: edgeId, color: 'var(--accent-hover)', width: 3 });
                        await sleep(speed / 2);
                        edges.update({id: edgeId, color: '#ffffff', width: 1 });
                    }
                    break;
                case 'update_dist':
                     nodes.update({ 
                         id: step.node,
                         color: { background: (step.direction === 'bwd' ? '#ffa500' : 'var(--frontier-color)') },
                         shapeProperties: { borderDashes: [5, 5] }
                    });
                    break;
                case 'final':
                    if (step.path && step.path.length > 0) {
                        for(let i = 0; i < step.path.length - 1; i++){
                            // CORRECTED: Using same robust logic as check_edge
                            const finalEdgeId = edges.getIds({
                                filter: e => (String(e.from) === step.path[i] && String(e.to) === step.path[i+1]) ||
                                             (String(e.to) === step.path[i] && String(e.from) === step.path[i+1])
                            })[0];
                            if(finalEdgeId) edges.update({id: finalEdgeId, color: 'var(--path-color)', width: 4});
                        }
                        const pathNodeUpdates = step.path.map(id => ({id: id, color: {background: 'var(--path-color)', border: 'var(--path-color)'}}));
                        nodes.update(pathNodeUpdates);
                    } else {
                        logMessage("No path found.");
                    }
                    displayFinalResults(step, algo);
                    break;
                case 'negative_cycle':
                    alert(step.message);
                    break;
            }
            await sleep(speed);
        }
    }
    
    function updateTable(step, algo) {
        const tbody = document.querySelector('#iterative-table tbody');
        if (tbody.querySelector('.highlighted')) tbody.querySelector('.highlighted').classList.remove('highlighted');
        
        let rowId;
        if(step.type === 'update_dist' || step.type === 'visit') rowId = `row-${step.node}`;
        else if (step.type === 'check_edge') rowId = `row-${step.from}`;

        if (rowId && document.getElementById(rowId)) document.getElementById(rowId).classList.add('highlighted');
        
        if (step.type === 'init') {
            document.querySelector(`#row-${step.start_node} > td:nth-child(2)`).textContent = '0';
        } else if (step.type === 'update_dist') {
            const r = document.getElementById(`row-${step.node}`);
            if (r) {
                if (algo === 'a_star') {
                    r.cells[1].textContent = step.new_dist.toFixed(1);
                    r.cells[2].textContent = step.h_score.toFixed(1);
                    r.cells[3].textContent = step.f_score.toFixed(1);
                    r.cells[4].textContent = step.from;
                } else {
                    r.cells[1].textContent = step.new_dist;
                    r.cells[2].textContent = step.from;
                }
            }
        }
    }
    
    function displayFinalResults(result, algo) {
        const { path, cost, nodes_visited } = result;
        const pathStr = path.length > 0 ? path.join(' -> ') : 'Not Found';
        const costStr = (typeof cost === 'number' && cost !== Infinity) ? cost.toFixed(2) : 'N/A';
        
        document.getElementById('final-path').textContent = `Path: ${pathStr}`;
        document.getElementById('final-cost').textContent = `Total Cost: ${costStr}`;
        document.getElementById('nodes-visited').textContent = `Nodes Visited: ${nodes_visited}`;

        // Update comparison table
        const comparisonBody = document.querySelector('#comparison-table tbody');
        comparisonBody.innerHTML += `
            <tr>
                <td>${algo.replace('_', ' ')}</td>
                <td>${costStr}</td>
                <td>${nodes_visited}</td>
                <td>${path.length > 0 ? '✔️' : '❌'}</td>
            </tr>`;
    }


    // --- INITIALIZATION CALL ---
    initializeNetwork();
    updateExplanation();
});
