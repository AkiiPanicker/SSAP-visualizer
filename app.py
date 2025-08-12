from flask import Flask, render_template, request, jsonify
from algorithms.graph_logic import dijkstra, a_star, bellman_ford, bidirectional_dijkstra

app = Flask(__name__)

# Algorithm mapping
ALGORITHMS = {
    'dijkstra': dijkstra,
    'a_star': a_star,
    'bellman_ford': bellman_ford,
    'bidirectional': bidirectional_dijkstra,
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/solve', methods=['POST'])
def solve_graph():
    data = request.get_json()
    
    graph_data = data.get('graph')
    start_node = data.get('startNode')
    end_node = data.get('endNode')
    algorithm = data.get('algorithm')

    if not all([graph_data, start_node, end_node, algorithm]):
        return jsonify({'error': 'Missing required parameters'}), 400

    if algorithm not in ALGORITHMS:
        return jsonify({'error': 'Invalid algorithm specified'}), 400

    # Get the algorithm function
    solver_func = ALGORITHMS[algorithm]
    
    # Run the solver and get the steps for animation
    try:
        steps = solver_func(graph_data, str(start_node), str(end_node))
        return jsonify(steps)
    except Exception as e:
        # Provide a meaningful error back to the frontend
        print(f"Error during {algorithm} execution: {e}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True)
