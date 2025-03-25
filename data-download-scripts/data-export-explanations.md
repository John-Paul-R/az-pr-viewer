# Data Export

## Git Revisions

### Where are all the old commits?

One thing you'll quickly notice if you attempt to assemble complete PR
information using a regular old clone of the relevant Azure git repository is
that some of the refs referenced in the PR simply don't exist. In particular,
the commit objects for commits that exist in PRs you've never personally checked
out, but have since been merged and had their branches deleted on the remote
will not exist in your local copy.

This isn't entirely surprising, as it would be rather expensive to clone these
down for each user on every fresh clone -- and would almost always be
unnecessary. To cut a long story short, most simple methods available in git to
attempt to bulk-pull the 'deleted' refs that exist on the remote simply do not
seem to work. To get this information anyway, we will have to be clever.

One thing that _does_ work, thankfully, is `get fetch`-ing a 'deleted' commit
hash. So, if we can list all the commit hashes our local repo doesn't know
about...

### Listing historical commits -- "Commits API"

Azure has to expose this information somehow, and they do. They have a paged
JSON-based API for retrieving commit information -- all of it, even the elusive
'deleted' PR-only ones. You can simply drain this data source (I recommend
stripping out just the commit hash and immediately writing that to a file for
later processing).

TODO: include commits script

### Fetching the commit content

Once you have a list of all the commits that the remote knows about, we have the
simpler problem of seeing which of those your local git instance doesn't know
about. It is important to be a bit mindful about how exactly we check, because
script-orchestrated iteration is likely to be painfully slow for most
medium-to-large repositories. Luckily, git has a tool for this!

```bash
git cat-file --batch-check
```

This little command will be our savior for today. Simply pipe your output file
(which should have one commit per line) into this bad boy, and you'll have your
list of "missing in local, present in remote" commits in no time! (well, not no
time, but way less time than if you tried to handroll it!)

Now, for the fetch itself, while it is appealing to parallelize this task to
hell and back, a better approach awaits us: Batching! (Yes, you can parallelize
to, ymmv)

In particular, the `git fetch` command actually accepts an arbitarary list of
revisions to fetch. In my case, going in batches of 100 proved fairly effective.

A simple bit of `xargs` fun can trivialize this bit, like so:

```
TODO: actually retrieve the scripts I used!
```
