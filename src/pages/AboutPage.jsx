import { Link } from 'react-router-dom'

export default function AboutPage() {
  return (
    <div className="c-shell about-page">
      <section className="c-card about-card">
        <div className="c-card-header">
          <h1>About This Project</h1>
          <Link className="c-button-quiet" to="/">Back to Rankings</Link>
        </div>
        <div className="c-card-body about-body">
          <p>
            This is my personal way of ranking every movie I watch. Instead of trying to score every film on an
            absolute scale, I compare films directly and let the ratings evolve over time.
          </p>

          <h2>Why Elo?</h2>
          <p>
            The system uses Elo, the same style of rating model used in chess. Elo is great for this kind of thing
            because it reacts to outcomes between two opponents. In this case, the opponents are movies.
          </p>

          <h2>How Ranking Works Here</h2>
          <p>
            Movies are grouped into tournaments. During a tournament, I get head-to-head matchups and pick a winner
            (or a draw). After each result, ratings move based on the matchup.
          </p>

          <h2>Head-to-Head Face-Offs</h2>
          <p>
            If a lower-rated film beats a higher-rated one, it gains more Elo. If a favorite wins as expected, ratings
            move less. That keeps the list stable but still lets surprise results matter.
          </p>

          <h2>Shifting Scores Over Time</h2>
          <p>
            Nothing is locked forever. As I keep rating films in new tournaments, Elo shifts and the leaderboard
            updates. The top of the list is always a reflection of current comparisons, not a one-time static ranking.
          </p>
        </div>
      </section>
    </div>
  )
}
