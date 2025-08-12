document.addEventListener('DOMContentLoaded', () => {

    // ===================================================================================
    // 1. GLOBAL VARIABLES & STATE MANAGEMENT
    // ===================================================================================

    // The main Vis.js network instance
    let network = null;

    // DataSets for holding nodes and edges. Vis.js makes these reactive.
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();

    // State variables to track the simulation
    let startNode = null;
    let endNode = null;
    let isAnimating = false;
    
    // A callback variable to handle the result of the custom modal
    let weightModalCallback = null;

    // A single object to hold references to all frequently used DOM elements.
    // This improves performance and code organization.
    const DOMElements = {
        container: document.getElementById('mynetwork'),
        logBox: document.getElementById('log'),
        nodeCountInput: document.getElementById('node-count-input'),
        algoSelect: document.getElementById('algo-select'),
        nodeEditor: document.getElementById('node-editor'),
        selectedNodeIdSpan: document.getElementById('selected-node-id'),
        connectionsList: document.getElementById('connections-list'),
        explanationContainer: document.getElementById('explanation-container'),
        weightModal: document.getElementById('weight-modal'),
        weightInput: document.getElementById('weight-input'),
        finalPath: document.getElementById('final-path'),
        finalCost: document.getElementById('final-cost'),
        nodesVisited: document.getElementById('nodes-visited'),
        comparisonBody: document.querySelector('#comparison-table tbody'),
        iterTableBody: document.querySelector('#iterative-table tbody'),
        iterThead: document.querySelector('#iterative-table thead'),
    };

    // Store detailed explanations for each algorithm.
    const EXPLANATIONS = {
        dijkstra: `<h3>Dijkstra's Algorithm</h3><p>Calculates the shortest path from a source node to all other nodes in a graph with <strong>non-negative</strong> edge weights.</p><p>It's a "greedy" algorithm that always explores the closest unvisited node.</p>`,
        a_star: `<h3>A* Search</h3><p>An "informed" search algorithm, often more efficient than Dijkstra for finding a path to a specific target. It uses a heuristic (an educated guess) to prioritize its search. It also requires non-negative weights.</p>`,
        bellman_ford: `<h3>Bellman-Ford Algorithm</h3><p>Slower than Dijkstra, but highly versatile. It calculates all shortest paths from a source and can handle graphs with <strong>negative</strong> edge weights. It will also detect if the graph contains a negative-weight cycle, which would make shortest paths meaningless.</p>`,
        bidirectional: `<h3>Bidirectional Dijkstra</h3><p>An optimized search that runs from both the start and end nodes simultaneously, meeting in the middle. It's extremely fast for finding a single path in large graphs but requires non-negative weights and is not suitable for finding paths to all nodes.</p>`,
    };

    // ===================================================================================
    // 2. UTILITY & UI HELPER FUNCTIONS
    // ===================================================================================

    // Logs a message to the on-screen console.
    const log = (msg, clear = false) => {
        if (clear) {
            DOMElements.logBox.innerHTML = '';
        }
        DOMElements.logBox.innerHTML += `<p>> ${msg}</p>`;
        DOMElements.logBox.scrollTop = DOMElements.logBox.scrollHeight;
    };

    // A simple promise-based delay function for animations.
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Gets the current animation speed from the slider.
    const getSpeed = () => 1100 - document.getElementById('speed-slider').value;
    
    // Converts a CSS variable like '--path-color' to its HEX value for Vis.js.
    const varToHex = (cssVar) => getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    
    // Enables or disables all control panel inputs during animation.
    const setControlsEnabled = (enabled) => {
        const elements = document.querySelectorAll('#controls-panel button, #controls-panel select, #controls-panel input');
        elements.forEach(el => {
            el.disabled = !enabled;
        });
        isAnimating = !enabled;
    };

    // Shows the custom modal for weight input.
    const showWeightModal = (defaultValue, callback) => {
        DOMElements.weightInput.value = defaultValue;
        weightModalCallback = callback;
        DOMElements.weightModal.classList.add('active');
        // Focus after the transition to ensure it works.
        setTimeout(() => DOMElements.weightInput.focus(), 50);
    };

    // Hides the modal and processes the callback.
    const handleModal = (isOk) => {
        if (weightModalCallback) {
            const value = parseInt(DOMElements.weightInput.value);
            // Callback with the value if OK was clicked, otherwise with NaN.
            weightModalCallback(isOk ? value : NaN);
        }
        DOMElements.weightModal.classList.remove('active');
    };
    
    // Updates the explanation text based on the selected algorithm.
    const updateExplanations = () => {
        const selectedAlgo = DOMElements.algoSelect.value;
        DOMElements.explanationContainer.innerHTML = EXPLANATIONS[selectedAlgo] || '<p>Select an algorithm to see its explanation.</p>';
    };

    // ===================================================================================
    // 3. VIS.JS NETWORK INITIALIZATION & CONFIGURATION
    // ===================================================================================

    // --- In static/js/main.js ---

// --- In static/js/main.js ---

// REPLACE your old initializeNetwork function with this one.

function initializeNetwork() {
    
    // This is the data object that Vis.js will visualize.
    // It's linked to our global `nodes` and `edges` DataSet objects.
    const data = {
        nodes: nodes,
        edges: edges
    };

    // This is the main configuration object that defines the network's appearance and behavior.
    const options = {
        // --- General Node Styling ---
        nodes: {
            shape: 'dot',
            size: 30, // Larger size for better label readability
            font: {
                size: 18,
                color: '#ffffff',
                face: 'Roboto',
            },
            borderWidth: 2
        },

        // --- General Edge Styling ---
        edges: {
            width: 2,
            font: {
                size: 14,
                color: '#ffffff',
                strokeWidth: 5,   // Dark outline makes edge weights pop
                strokeColor: '#1a1b26' 
            },
            arrows: {
                to: { enabled: true, scaleFactor: 0.7 }
            },
            smooth: false, // Use straight lines for clarity
            
            // ===============================================
            // NEWLY ADDED SECTION FOR SELF-LOOPS
            // ===============================================
            selfReference: {
                size: 30,           // The diameter of the self-loop circle
                angle: Math.PI / 4, // Positions the loop at a 45-degree angle
                renderBehindTheNode: true // Ensures the loop circle doesn't obscure the node number
            }
        },

        // --- Physics Engine for Layout ---
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -50,
                springLength: 100
            }
        },

        // --- User Interaction Settings ---
        interaction: {
            dragNodes: true,
            dragView: true,
            zoomView: true
        }
    };

    // Create the new network instance with the data and options.
    network = new vis.Network(DOMElements.container, data, options);
    
    // Attach all the custom event listeners (for clicks, modals, etc.).
    setupEventListeners();
    
    // Create the initial graph on the canvas when the page loads.
    generateRandomGraph();
}
    
    // ===================================================================================
    // 4. EVENT LISTENER SETUP
    // ===================================================================================

    function setupEventListeners() {
        document.getElementById('random-btn').addEventListener('click', generateRandomGraph);
        document.getElementById('clear-btn').addEventListener('click', () => {
            network.stopSimulation();
            nodes.clear();
            edges.clear();
            startNode = null;
            endNode = null;
            // Add a single node so the user has something to start building with
            nodes.add({id:1, label:'1'});
            log("Canvas Cleared. Added Node 1 for you to start building!", true);
            DOMElements.nodeEditor.style.display = 'none';
        });
        document.getElementById('start-btn').addEventListener('click', runAlgorithm);
        document.getElementById('reset-btn').addEventListener('click', () => { if (!isAnimating) resetVisuals(); });
        document.getElementById('set-start-btn').addEventListener('click', () => setStartEndNode('start'));
        document.getElementById('set-end-btn').addEventListener('click', () => setStartEndNode('end'));
        document.getElementById('delete-node-btn').addEventListener('click', deleteSelectedNode);
        DOMElements.algoSelect.addEventListener('change', updateExplanations);

        // Network-specific events
        network.on('click', handleNetworkClick);
        network.on('doubleClick', handleNetworkDoubleClick);
        
        // Modal and window events
        document.getElementById('modal-ok-btn').addEventListener('click', () => handleModal(true));
        document.getElementById('modal-cancel-btn').addEventListener('click', () => handleModal(false));
        window.addEventListener('keydown', (e) => {
            // Allow 'Enter' in modal input
            if(e.key === 'Enter' && document.activeElement === DOMElements.weightInput) {
                handleModal(true);
            }
            // Allow 'Escape' to close modal
            else if (e.key === 'Escape' && DOMElements.weightModal.classList.contains('active')) {
                handleModal(false);
            }
        });
        
        // Tab functionality for the info panel
        document.querySelectorAll('.tab-link').forEach(button => {
            button.addEventListener('click', (event) => {
                // Remove 'active' from all tabs and content panels
                document.querySelectorAll('.tab-link, .tab-content').forEach(el => el.classList.remove('active'));
                // Add 'active' to the clicked button and its corresponding content panel
                const tabId = event.currentTarget.dataset.tab;
                event.currentTarget.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    // ===================================================================================
    // 5. UI INTERACTION LOGIC (Graph manipulation, etc.)
    // ===================================================================================

    // Generates a new random graph based on user input
    function generateRandomGraph() {
        network.stopSimulation();
        nodes.clear();
        edges.clear();
        startNode = null;
        endNode = null;
        DOMElements.nodeEditor.style.display = 'none';
        
        const numNodes = Math.max(2, parseInt(DOMElements.nodeCountInput.value));
        const newNodes = Array.from({ length: numNodes }, (_, i) => ({ id: i + 1, label: String(i + 1) }));
        nodes.add(newNodes);
        
        const newEdges = [];
        for (let i = 1; i <= numNodes; i++) {
            for (let j = i + 1; j <= numNodes; j++) {
                if (Math.random() > 0.6) {
                    newEdges.push({ from: i, to: j, label: String(Math.floor(Math.random() * 20) + 1) });
                }
            }
        }
        edges.add(newEdges);
        network.fit();
        log("Generated a new random graph.", true);
    }
    
    // Handles setting the start or end node.
    function setStartEndNode(type) {
        const nodeId = DOMElements.selectedNodeIdSpan.innerText;
        if (!nodeId) return;

        let oldNodeToClear = (type === 'start') ? startNode : endNode;
        // Only clear the color if the node isn't also the other special node (e.g., start is also end)
        if(oldNodeToClear && oldNodeToClear !== (type === 'start' ? endNode : startNode)) {
            const defaultColor = varToHex('--accent-color');
            nodes.update({ id: oldNodeToClear, color: { background: defaultColor, border: defaultColor }, shadow: false });
        }
        
        if (type === 'start') startNode = nodeId;
        else endNode = nodeId;
        
        const newColor = varToHex(type === 'start' ? '--start-node-color' : '--end-node-color');
        nodes.update({ id: nodeId, color: { background: newColor, border: newColor }, shadow: { enabled: true, color: newColor, size: 20 }});
        log(`Node ${nodeId} set as ${type.toUpperCase()}.`);
    }

    // Deletes the currently selected node and its edges.
    function deleteSelectedNode() {
        const nodeId = DOMElements.selectedNodeIdSpan.innerText;
        if (!nodeId) return;
        nodes.remove(nodeId); // vis.js automatically removes connected edges
        if(startNode === nodeId) startNode = null;
        if(endNode === nodeId) endNode = null;
        DOMElements.nodeEditor.style.display = 'none';
        log(`Deleted Node ${nodeId}.`);
    }

    // Main handler for clicks on the network canvas.
    function handleNetworkClick(params) {
        const nodeId = params.nodes[0];
        if (nodeId) {
            DOMElements.nodeEditor.style.display = 'block';
            DOMElements.selectedNodeIdSpan.innerText = nodeId;
            populateConnectionsEditor(nodeId);
        } else {
            DOMElements.nodeEditor.style.display = 'none';
        }
    }

    // Main handler for double-clicks on the network canvas.
    function handleNetworkDoubleClick(params) {
        if (params.edges[0]) { // Double-clicked an edge
            const edge = edges.get(params.edges[0]);
            showWeightModal(edge.label, (newWeight) => {
                if (!isNaN(newWeight)) {
                    edges.update({ id: edge.id, label: String(newWeight) });
                }
            });
        } else if (!params.nodes[0]) { // Double-clicked empty space
            const newId = (nodes.length > 0 ? Math.max(...nodes.getIds()) : 0) + 1;
            nodes.add({ id: newId, label: String(newId), x: params.pointer.canvas.x, y: params.pointer.canvas.y });
            log(`Added Node ${newId}.`);
        }
    }
/**
 * Dynamically builds the robust connection editor, including self-loops
 * and separate checkboxes for incoming/outgoing edges. This version includes
 * the critical fix for correctly deleting edges on uncheck.
 * @param {string} selectedNodeId - The ID of the currently selected node.
 */
function populateConnectionsEditor(selectedNodeId) {
    // Start by clearing any old UI from the editor panel to prevent duplicates.
    DOMElements.connectionsList.innerHTML = '';

    // --- Part 1: Build and Handle the Self-Loop UI ---
    
    // Check if a self-loop edge exists for the selected node when the editor is first drawn.
    // This is used to set the initial "checked" state of the checkbox.
    const initialSelfLoopEdge = edges.get({
        filter: e => e.from == selectedNodeId && e.to == selectedNodeId
    })[0];
    
    // Create the HTML structure for the self-loop section using a template literal.
    const selfLoopItem = document.createElement('div');
    selfLoopItem.className = 'connection-item';
    selfLoopItem.innerHTML = `
        <div class="connection-header">Self Loop</div>
        <div class="connection-controls">
            <div class="connection-row">
                <label>
                    <input type="checkbox" data-type="self" ${initialSelfLoopEdge ? 'checked' : ''}>
                    Edge to Self
                </label>
            </div>
        </div>
    `;
    // Add this new UI element to the DOM.
    DOMElements.connectionsList.appendChild(selfLoopItem);

    // Now, find the checkbox we just created and add its interactive logic.
    const selfLoopCheckbox = selfLoopItem.querySelector('input[data-type="self"]');
    selfLoopCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
            // Logic for CREATING a self-loop when the checkbox is ticked.
            showWeightModal(5, weight => {
                if (!isNaN(weight)) {
                    // User provided a valid weight, so create the edge.
                    edges.add({ from: selectedNodeId, to: selectedNodeId, label: String(weight) });
                } else {
                    // User canceled, so revert the checkbox to its unchecked state.
                    event.target.checked = false;
                }
            });
        } else {
            // Logic for REMOVING a self-loop when the checkbox is unticked.
            // **THE BUG FIX:** Re-query the edge at the exact moment of the click.
            // This ensures we have the current, not the initial, state of the graph.
            const edgeToRemove = edges.get({
                filter: e => e.from == selectedNodeId && e.to == selectedNodeId
            })[0];

            if (edgeToRemove) {
                // If an edge was found, remove it.
                edges.remove(edgeToRemove.id);
            }
        }
    });

    // --- Part 2: Build and Handle Connections to ALL Other Nodes ---

    // Get an array of all nodes in the graph, excluding the one currently selected.
    const allOtherNodes = nodes.get({
        filter: n => n.id != selectedNodeId
    }).sort((a,b) => parseInt(a.id) - parseInt(b.id)); // Ensure correct numeric sorting
    
    // Loop through each of these other nodes to build its specific editor UI.
    allOtherNodes.forEach(otherNode => {
        const otherNodeId = otherNode.id;

        // Check for existing edges when the editor is first drawn for initial state.
        const initialOutgoingEdge = edges.get({ filter: e => e.from == selectedNodeId && e.to == otherNodeId })[0];
        const initialIncomingEdge = edges.get({ filter: e => e.from == otherNodeId && e.to == selectedNodeId })[0];

        // Create the container element for this node's connection controls.
        const itemDiv = document.createElement('div');
        itemDiv.className = 'connection-item';
        itemDiv.innerHTML = `
            <div class="connection-header">Node ${otherNodeId}</div>
            <div class="connection-controls">
                <div class="connection-row">
                    <label>
                        <input type="checkbox" data-type="outgoing" ${initialOutgoingEdge ? 'checked' : ''}>
                         Outgoing (Selected → Other)
                    </label>
                </div>
                <div class="connection-row">
                    <label>
                        <input type="checkbox" data-type="incoming" ${initialIncomingEdge ? 'checked' : ''}>
                         Incoming (Other → Selected)
                    </label>
                </div>
            </div>
        `;
        // Add the new element to the DOM.
        DOMElements.connectionsList.appendChild(itemDiv);
        
        // Find the specific checkboxes we just created within this element.
        const outgoingCheckbox = itemDiv.querySelector('input[data-type="outgoing"]');
        const incomingCheckbox = itemDiv.querySelector('input[data-type="incoming"]');
        
        // Add the corrected event listener for the OUTGOING checkbox.
        outgoingCheckbox.addEventListener('change', (event) => {
            if (event.target.checked) {
                // Logic for creating the edge.
                showWeightModal(5, weight => {
                    if (!isNaN(weight)) {
                        edges.add({ from: selectedNodeId, to: otherNodeId, label: String(weight) });
                    } else {
                        event.target.checked = false;
                    }
                });
            } else {
                // **THE BUG FIX:** Re-query for the specific outgoing edge at this moment.
                const edgeToRemove = edges.get({ filter: e => e.from == selectedNodeId && e.to == otherNodeId })[0];
                if (edgeToRemove) {
                    edges.remove(edgeToRemove.id);
                }
            }
        });

        // Add the corrected event listener for the INCOMING checkbox.
        incomingCheckbox.addEventListener('change', (event) => {
            if (event.target.checked) {
                // Logic for creating the edge.
                showWeightModal(5, weight => {
                    if (!isNaN(weight)) {
                        edges.add({ from: otherNodeId, to: selectedNodeId, label: String(weight) });
                    } else {
                        event.target.checked = false;
                    }
                });
            } else {
                // **THE BUG FIX:** Re-query for the specific incoming edge at this moment.
                const edgeToRemove = edges.get({ filter: e => e.from == otherNodeId && e.to == selectedNodeId })[0];
                if (edgeToRemove) {
                    edges.remove(edgeToRemove.id);
                }
            }
        });
    });
}

    // ===================================================================================
    // 6. CORE ALGORITHM & ANIMATION
    // ===================================================================================

    // Starts the selected algorithm.
    async function runAlgorithm() {
        if (!startNode || !endNode) return alert('Please select both a START and an END node.');
        const algo = DOMElements.algoSelect.value;
        if (['dijkstra', 'a_star', 'bidirectional'].includes(algo) && edges.get().some(e => parseInt(e.label) < 0)) return alert(`Error: ${algo.replace('_', ' ')} does not support negative edge weights.\n\nPlease use Bellman-Ford or remove the negative weights.`);
        
        resetVisuals();
        setControlsEnabled(false);
        log(`Starting ${algo.replace('_',' ')}...`, true);
        setupIterativeTable(algo);

        try {
            const requestBody = {
                graph: { nodes: nodes.get({fields: ['id', 'x', 'y']}), edges: edges.get({fields:['from', 'to', 'label']}) },
                startNode,
                endNode,
                algorithm: algo
            };
            const response = await fetch('/api/solve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
            if (!response.ok) throw new Error((await response.json()).error || 'API call failed');
            const steps = await response.json();
            await animateSteps(steps, algo);
        } catch(err) { log(`Error: ${err.message}`); alert(`Error: ${err.message}`); } finally { setControlsEnabled(true); }
    }

    // Resets the visuals of the graph to its base state.
    function resetVisuals() {
        nodes.getIds().forEach(id => {
            let color = varToHex('--accent-color');
            let hasShadow = false;
            if (id == startNode) { color = varToHex('--start-node-color'); hasShadow = true; }
            if (id == endNode) { color = varToHex('--end-node-color'); hasShadow = true; }
            nodes.update({ id: id, color: { background: color, border: color }, shadow: hasShadow ? {enabled:true, color:color, size:20} : false });
        });
        edges.getIds().forEach(id => edges.update({ id: id, color: null, width: 2, shadow: false }));
        DOMElements.iterTableBody.innerHTML = ''; DOMElements.iterThead.innerHTML = '';
    }

    // The main animation loop that iterates through steps from the backend.
    async function animateSteps(steps, algo) {
        const glow = (colorVar, size=20) => ({ enabled: true, size, color: varToHex(colorVar)});
        
        for (const step of steps) {
            log(step.message || '');
            if(step.node) nodes.update({ id: step.node, font: {size: 30}});

            switch(step.type) {
                case 'visit':
                    const visitColorVar = step.direction === 'bwd' ? '--path-color' : '--visited-color';
                    const visitColor = varToHex(visitColorVar);
                    nodes.update({ id: step.node, shadow: glow(visitColorVar), color: { background: visitColor, border: visitColor }});
                    break;
                case 'check_edge':
                    const edgeId = edges.getIds({ filter: e => (e.from == step.from && e.to == step.to) || (e.to == step.from && e.from == step.to)})[0];
                    if (edgeId) { edges.update({id: edgeId, width: 5, shadow: glow('--accent-hover', 10)}); await sleep(getSpeed()/2); edges.update({id: edgeId, width: 2, shadow: false}); }
                    break;
                case 'update_dist': nodes.update({ id: step.node, shadow: glow('--frontier-color')}); break;
                case 'final':
                    if (step.path?.length > 0) {
                        for(let i=0; i < step.path.length-1; i++){
                            const finalEdgeId=edges.getIds({filter:e=>(e.from==step.path[i] && e.to==step.path[i+1]) || (e.to==step.path[i] && e.from==step.path[i+1])})[0];
                            if(finalEdgeId) edges.update({id:finalEdgeId, color:varToHex('--path-color'), width:6, shadow:glow('--path-color')});
                        }
                    }
                    displayFinalResults(step, algo);
                    break;
                case 'negative_cycle': alert(step.message); break;
            }
            
            updateTable(step, algo);
            if(step.node) { await sleep(getSpeed()); nodes.update({ id: step.node, font: {size: 16}}); }
            else { await sleep(getSpeed() / 3); }
        }
    }

    // ===================================================================================
    // 7. TABLE & RESULTS LOGIC
    // ===================================================================================
    
    // Sets up the headers for the live data table.
    function setupIterativeTable(algo) {
        let headers = ['Node', 'Cost', 'Previous'];
        if (algo === 'a_star') headers = ['Node', 'g(n)', 'h(n)', 'f(n)', 'Previous'];
        DOMElements.iterThead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        DOMElements.iterTableBody.innerHTML = nodes.getIds().sort((a,b) => a - b).map(id => `<tr id="row-${id}"><td class="node-id">${id}</td>${headers.slice(1).map(() => '<td>-</td>').join('')}</tr>`).join('');
    }

    // Updates the live data table based on the current animation step.
    function updateTable(step, algo) {
        document.querySelectorAll('tr.highlighted').forEach(r => r.classList.remove('highlighted'));
        let highlightId = step.node || step.from;
        if(highlightId) { const row = document.getElementById(`row-${highlightId}`); if(row) row.classList.add('highlighted');}

        const updateAllRows = (allDists) => { if (!allDists) return; for(const [node, val] of Object.entries(allDists)) { const r = document.getElementById(`row-${node}`); if(r) r.cells[1].textContent = (typeof val === 'number') ? val.toFixed(1) : val; }};

        if(algo === 'a_star' && step.type === 'update_dist' && step.node) { const r = document.getElementById(`row-${step.node}`); if (r) { r.cells[1].textContent=step.g_score.toFixed(1); r.cells[2].textContent=step.h_score.toFixed(1); r.cells[3].textContent=step.f_score.toFixed(1); r.cells[4].textContent=step.from;}} 
        else if (['dijkstra', 'bellman_ford'].includes(algo) && step.all_distances) { updateAllRows(step.all_distances); } 
        else if (step.type === 'init' && algo !== 'a_star' && step.all_distances) { updateAllRows(step.all_distances); const r = document.getElementById(`row-${startNode}`); if(r) r.cells[1].textContent = 0; }
    }

    // Displays the final results in the results panel.
    function displayFinalResults(result, algo) {
        const { path, cost, nodes_visited, all_distances } = result;
        const pathStr = path?.length > 0 ? path.join(' → ') : 'Not Found';
        const costStr = (typeof cost === 'number' && cost !== Infinity) ? cost.toFixed(1) : 'N/A';
        DOMElements.finalPath.textContent = pathStr;
        DOMElements.finalCost.textContent = costStr;
        DOMElements.nodesVisited.textContent = nodes_visited;
        if (all_distances) updateTable({ type: 'final', all_distances }, algo);
        DOMElements.comparisonBody.innerHTML += `<tr><td>${algo.replace(/_/g,' ')}</td><td>${costStr}</td><td>${nodes_visited}</td><td>${path?.length > 0 ? '✔️' : '❌'}</td></tr>`;
    }

    // ===================================================================================
    // 8. SCRIPT INITIALIZATION
    // ===================================================================================
    initializeNetwork();
    updateExplanations();
});
