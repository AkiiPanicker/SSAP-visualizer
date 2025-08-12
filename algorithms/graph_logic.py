import heapq
import math

# --- Helper function to reconstruct graph from JSON ---
def build_adjacency_list(graph_data):
    """
    Builds an adjacency list from the graph data received from the frontend.
    Handles potential non-numeric or negative weights gracefully.
    """
    adj = {str(node['id']): [] for node in graph_data['nodes']}
    for edge in graph_data['edges']:
        u, v = str(edge['from']), str(edge['to'])
        try:
            # Allow for negative integer weights.
            weight = int(edge['label'])
        except (ValueError, TypeError):
            # Default to a weight of 1 if the label is invalid (e.g., empty string).
            weight = 1
        
        adj[u].append({'node': v, 'weight': weight})
        
        # Assume graph is undirected for pathfinding algos (can be overridden).
        if not graph_data.get('directed', False):
             adj.setdefault(v, []).append({'node': u, 'weight': weight})
    return adj

# --- Heuristic for A* (Euclidean distance) ---
def heuristic(node1_pos, node2_pos):
    """Calculates the straight-line distance heuristic for A*."""
    if not node1_pos or not node2_pos: return 0
    return math.sqrt((node1_pos.get('x',0) - node2_pos.get('x',0))**2 + (node1_pos.get('y',0) - node2_pos.get('y',0))**2) / 100

# --- Path Reconstruction Utility ---
def reconstruct_path(previous, start_node, end_node):
    """Backtracks from the end node to reconstruct the shortest path."""
    path = []
    current_node = end_node
    while current_node is not None:
        path.append(current_node)
        current_node = previous.get(current_node)
    path.reverse()
    return path if path and path[0] == start_node else []

# --- Dijkstra's Algorithm (Updated to find all paths) ---
def dijkstra(graph_data, start_node, end_node):
    """
    Implementation of Dijkstra's algorithm.
    MODIFIED: Runs to completion to find the shortest path from start_node to all other nodes.
    The path to end_node is specifically reconstructed for highlighting.
    """
    adj = build_adjacency_list(graph_data)
    nodes_set = {str(node['id']) for node in graph_data['nodes']}
    
    distances = {node: float('inf') for node in nodes_set}
    previous = {node: None for node in nodes_set}
    distances[start_node] = 0
    pq = [(0, start_node)]  # (distance, node)
    visited = set()
    steps = [{'type': 'init', 'all_distances': {n: '∞' for n in nodes_set}, 'start_node': start_node, 'message': "Initializing Dijkstra..."}]

    while pq:
        dist, current_node = heapq.heappop(pq)
        
        if current_node in visited:
            continue
        visited.add(current_node)
        
        steps.append({'type': 'visit', 'node': current_node, 'cost': dist, 'message': f'Finalized cost for node {current_node} is {dist}.'})

        for edge in adj.get(current_node, []):
            neighbor, weight = edge['node'], edge['weight']
            steps.append({'type': 'check_edge', 'from': current_node, 'to': neighbor, 'message': f'Checking neighbor {neighbor}...'})
            
            if distances[current_node] + weight < distances[neighbor]:
                distances[neighbor] = distances[current_node] + weight
                previous[neighbor] = current_node
                heapq.heappush(pq, (distances[neighbor], neighbor))
                
                # Create a snapshot of current distances for the animation step
                current_dist_snapshot = {k: v if v != float('inf') else '∞' for k,v in distances.items()}
                
                steps.append({
                    'type': 'update_dist',
                    'node': neighbor,
                    'new_dist': distances[neighbor],
                    'from': current_node,
                    'all_distances': current_dist_snapshot,
                    'message': f'Updated distance for {neighbor} to {distances[neighbor]}.'
                })
    
    # After completion, reconstruct the specific path requested for highlighting
    path_to_end = reconstruct_path(previous, start_node, end_node)
    cost_to_end = distances.get(end_node, 'N/A')
    # Finalize all distances for the results table
    final_distances = {k: v if v != float('inf') else 'N/A' for k, v in distances.items()}
    
    steps.append({'type': 'final', 'path': path_to_end, 'cost': cost_to_end, 'nodes_visited': len(visited), 'all_distances': final_distances, 'message': 'Algorithm Finished.'})
    return steps

# --- A* Search (Updated to find all paths) ---
def a_star(graph_data, start_node, end_node):
    """
    Implementation of A* search.
    MODIFIED: Runs to completion. Note that A*'s heuristic is destination-specific, so the "shortest paths"
    found to other nodes might not be truly the shortest if the algorithm were re-run with a different goal.
    This implementation demonstrates the process across the whole graph.
    """
    adj = build_adjacency_list(graph_data)
    nodes_set = {str(node['id']) for node in graph_data['nodes']}
    node_positions = {str(node['id']): node for node in graph_data['nodes']}
    end_pos = node_positions[end_node]
    
    g_scores = {node: float('inf') for node in nodes_set}
    g_scores[start_node] = 0
    f_scores = {node: float('inf') for node in nodes_set}
    f_scores[start_node] = heuristic(node_positions[start_node], end_pos)
    open_set = [(f_scores[start_node], start_node)]
    previous = {node: None for node in nodes_set}
    visited_for_count = set()
    steps = [{'type': 'init', 'all_distances': {n: ('∞', '∞', '∞') for n in nodes_set}, 'start_node': start_node, 'message': 'Initializing A*...'}]

    while open_set:
        _, current_node = heapq.heappop(open_set)
        if current_node in visited_for_count:
            continue
        visited_for_count.add(current_node)
        steps.append({'type': 'visit', 'node': current_node, 'cost': g_scores[current_node], 'message': f'Visiting node {current_node}.'})
        
        for edge in adj.get(current_node, []):
            neighbor, weight = edge['node'], edge['weight']
            steps.append({'type': 'check_edge', 'from': current_node, 'to': neighbor})
            tentative_g_score = g_scores[current_node] + weight
            
            if tentative_g_score < g_scores.get(neighbor, float('inf')):
                previous[neighbor] = current_node
                g_scores[neighbor] = tentative_g_score
                h_val = heuristic(node_positions.get(neighbor), end_pos)
                f_scores[neighbor] = tentative_g_score + h_val
                heapq.heappush(open_set, (f_scores[neighbor], neighbor))
                steps.append({
                    'type': 'update_dist', 'node': neighbor,
                    'g_score': tentative_g_score, 'h_score': h_val, 'f_score': f_scores[neighbor],
                    'from': current_node, 'message': f'Updating {neighbor}: g={tentative_g_score:.1f}, f={f_scores[neighbor]:.1f}'
                })
    
    path_to_end = reconstruct_path(previous, start_node, end_node)
    cost_to_end = g_scores.get(end_node, 'N/A')
    final_g_scores = {k: v if v != float('inf') else 'N/A' for k,v in g_scores.items()}
    steps.append({'type': 'final', 'path': path_to_end, 'cost': cost_to_end, 'nodes_visited': len(visited_for_count), 'all_distances': final_g_scores, 'message': 'Algorithm Finished.'})
    return steps


# --- Bellman-Ford (Logic remains robust for all paths) ---
def bellman_ford(graph_data, start_node, end_node):
    """
    Implementation of the Bellman-Ford algorithm.
    Naturally finds all shortest paths and can detect negative weight cycles.
    """
    # This algorithm is treated as directed, respecting edge 'from' and 'to'
    edges_list = []
    for edge in graph_data['edges']:
        try:
            edges_list.append((str(edge['from']), str(edge['to']), int(edge['label'])))
        except (ValueError, TypeError):
            continue # Skip invalid edges
    
    nodes_set = {str(node['id']) for node in graph_data['nodes']}
    distances = {node: float('inf') for node in nodes_set}
    previous = {node: None for node in nodes_set}
    distances[start_node] = 0
    steps = [{'type': 'init', 'all_distances': {n: '∞' for n in nodes_set}, 'start_node': start_node, 'message': 'Initializing Bellman-Ford...'}]
    
    # Relax edges V-1 times
    for i in range(len(nodes_set) - 1):
        steps.append({'type': 'iteration', 'number': i + 1, 'message': f'--- Relaxation Iteration {i + 1} ---'})
        updated_in_iteration = False
        for u, v, w in edges_list:
            if distances.get(u, float('inf')) != float('inf') and distances[u] + w < distances.get(v, float('inf')):
                distances[v] = distances[u] + w
                previous[v] = u
                updated_in_iteration = True
                steps.append({'type': 'update_dist', 'node': v, 'new_dist': distances[v], 'from': u, 'all_distances': {k: v if v != float('inf') else '∞' for k,v in distances.items()}, 'message': f'Relaxing edge ({u}->{v}). New cost for {v} is {distances[v]}.'})
        if not updated_in_iteration:
            break  # Early exit optimization

    # Check for negative weight cycles
    for u, v, w in edges_list:
        if distances.get(u, float('inf')) != float('inf') and distances[u] + w < distances.get(v, float('inf')):
            steps.append({'type': 'negative_cycle', 'message': 'Error: Negative weight cycle detected!'})
            return steps

    path_to_end = reconstruct_path(previous, start_node, end_node)
    cost_to_end = distances.get(end_node, 'N/A')
    final_distances = {k: v if v != float('inf') else 'N/A' for k, v in distances.items()}
    steps.append({'type': 'final', 'path': path_to_end, 'cost': cost_to_end, 'nodes_visited': len(nodes_set), 'all_distances': final_distances, 'message': 'Algorithm Finished.'})
    return steps


# --- Bidirectional Dijkstra (Remains optimized for single path) ---
def bidirectional_dijkstra(graph_data, start_node, end_node):
    """
    Implementation of Bidirectional Dijkstra.
    This algorithm is an exception; its efficiency comes from *not* exploring the whole graph.
    It remains optimized to find the single path from start to end.
    """
    if start_node == end_node: return [{'type':'final', 'path': [start_node], 'cost':0, 'nodes_visited': 1, 'all_distances': {start_node: 0}}]

    steps = [{'type':'init', 'message': 'Initializing Bidirectional Search...'}]
    adj = build_adjacency_list(graph_data)
    nodes_set = {str(node['id']) for node in graph_data['nodes']}
    
    dist_fwd, dist_bwd = {n: float('inf') for n in nodes_set}, {n: float('inf') for n in nodes_set}
    prev_fwd, prev_bwd = {n: None for n in nodes_set}, {n: None for n in nodes_set}
    dist_fwd[start_node], dist_bwd[end_node] = 0, 0
    pq_fwd, pq_bwd = [(0, start_node)], [(0, end_node)]
    visited_fwd, visited_bwd = set(), set()
    mu, meet_node = float('inf'), None

    while pq_fwd and pq_bwd:
        if pq_fwd[0][0] + pq_bwd[0][0] >= mu: break

        if len(pq_fwd) <= len(pq_bwd):
            dist,u = heapq.heappop(pq_fwd)
            if u in visited_fwd: continue
            visited_fwd.add(u)
            steps.append({'type':'visit', 'node':u, 'direction':'fwd', 'cost':dist, 'message': f'Fwd search visiting {u}'})
            for edge in adj.get(u, []):
                v, w = edge['node'], edge['weight']
                if dist_fwd[u] + w < dist_fwd.get(v, float('inf')):
                    dist_fwd[v] = dist_fwd[u] + w
                    prev_fwd[v] = u
                    heapq.heappush(pq_fwd, (dist_fwd[v], v))
                    if v in visited_bwd and dist_fwd[v] + dist_bwd[v] < mu:
                        mu, meet_node = dist_fwd[v] + dist_bwd[v], v
                        steps.append({'type':'meet', 'node': v, 'cost': mu, 'message': f'Searches met at {v}! Best cost now {mu}'})
        else:
            dist,u = heapq.heappop(pq_bwd)
            if u in visited_bwd: continue
            visited_bwd.add(u)
            steps.append({'type':'visit', 'node':u, 'direction':'bwd', 'cost':dist, 'message': f'Bwd search visiting {u}'})
            for edge in adj.get(u, []):
                v, w = edge['node'], edge['weight']
                if dist_bwd[u] + w < dist_bwd.get(v, float('inf')):
                    dist_bwd[v] = dist_bwd[u] + w
                    prev_bwd[v] = u
                    heapq.heappush(pq_bwd, (dist_bwd[v], v))
                    if v in visited_fwd and dist_fwd[v] + dist_bwd[v] < mu:
                        mu, meet_node = dist_fwd[v] + dist_bwd[v], v
                        steps.append({'type':'meet', 'node': v, 'cost': mu, 'message': f'Searches met at {v}! Best cost now {mu}'})
    
    path = []
    final_dists = {n: 'N/A' for n in nodes_set} # Bidirectional does not provide all distances
    if meet_node:
        path_fwd = reconstruct_path(prev_fwd, start_node, meet_node)
        path = path_fwd
        # Reconstruct backward part manually
        curr = prev_bwd.get(meet_node)
        while curr is not None:
            path.append(curr)
            curr = prev_bwd.get(curr)
        final_dists[end_node] = mu

    steps.append({'type':'final','path':path,'cost': mu if mu != float('inf') else 'N/A', 'nodes_visited': len(visited_fwd | visited_bwd), 'all_distances': final_dists, 'message': 'Algorithm Finished.'})
    return steps
