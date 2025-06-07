// mgitUtils.js - Helper functions for MGit operations
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Gets the default branch for a repository
 * @param {string} repoPath - Path to the repository
 * @returns {string} - The default branch name
 */
function getDefaultBranch(repoPath) {
  try {
    // Try to find which branch HEAD points to
    const headPath = path.join(repoPath, '.mgit', 'HEAD');
    if (fs.existsSync(headPath)) {
      const headContent = fs.readFileSync(headPath, 'utf8').trim();
      const match = headContent.match(/ref: refs\/heads\/(.+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Fallback to assuming main or master
    return 'main';
  } catch (err) {
    console.error('Error getting default branch:', err);
    return 'main'; // Default fallback
  }
}

/**
 * Gets all branches in a repository
 * @param {string} repoPath - Path to the repository
 * @returns {Array<string>} - List of branch names
 */
function getBranches(repoPath) {
  try {
    // Use mgit branch command to list branches
    const output = execSync('mgit branch', { cwd: repoPath, encoding: 'utf8' });
    
    // Parse output to get branch names
    return output.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\*\s+/, '')); // Remove asterisk from current branch
  } catch (err) {
    console.error('Error getting branches:', err);
    return ['main']; // Default fallback
  }
}

/**
 * Gets repository description from README.md
 * @param {string} repoPath - Path to the repository
 * @returns {string} - Repository description
 */
function getRepoDescription(repoPath) {
  // Try to read description from README.md
  const readmePath = path.join(repoPath, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    const firstLine = readme.split('\n')[0];
    // Remove markdown heading markers
    return firstLine.replace(/^#+\s+/, '');
  }
  
  return 'No description available';
}

/**
 * Gets the date of the last commit
 * @param {string} repoPath - Path to the repository
 * @returns {string} - ISO formatted date string
 */
function getLastCommitDate(repoPath) {
  try {
    // Use mgit log to get last commit date
    const output = execSync('mgit log -1 --format=%cd', { cwd: repoPath, encoding: 'utf8' });
    return new Date(output.trim()).toISOString();
  } catch (err) {
    console.error('Error getting last commit date:', err);
    return new Date().toISOString(); // Fallback to current date
  }
}

/**
 * Gets the repository creation date based on first commit
 * @param {string} repoPath - Path to the repository
 * @returns {string} - ISO formatted date string
 */
function getRepoCreationDate(repoPath) {
  try {
    // Use mgit log to get first commit date
    const output = execSync('mgit log --reverse --format=%cd | head -1', { cwd: repoPath, encoding: 'utf8' });
    return new Date(output.trim()).toISOString();
  } catch (err) {
    console.error('Error getting repo creation date:', err);
    return new Date().toISOString(); // Fallback to current date
  }
}

/**
 * Detects repository license type
 * @param {string} repoPath - Path to the repository
 * @returns {string} - License type
 */
function getLicense(repoPath) {
  // Check for common license files
  const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE.md'];
  
  for (const file of licenseFiles) {
    const licensePath = path.join(repoPath, file);
    if (fs.existsSync(licensePath)) {
      const content = fs.readFileSync(licensePath, 'utf8');
      
      // Very simple license detection
      if (content.includes('MIT')) return 'MIT';
      if (content.includes('Apache License')) return 'Apache-2.0';
      if (content.includes('GNU GENERAL PUBLIC')) return 'GPL-3.0';
      
      return 'Other';
    }
  }
  
  return 'None';
}

/**
 * Gets contents of a directory or info about a file in the repository
 * @param {string} repoPath - Path to the repository
 * @param {string} filePath - Path to the file or directory within the repository
 * @param {string} branch - Branch name (unused in current implementation)
 * @returns {Object|Array<Object>} - Information about the file or directory contents
 */
function getRepoContents(repoPath, filePath, branch) {
  const fullPath = path.join(repoPath, filePath);
  
  // Check if path exists
  if (!fs.existsSync(fullPath)) {
    throw new Error('Path not found');
  }
  
  // Check if it's a directory
  const isDirectory = fs.statSync(fullPath).isDirectory();
  
  if (isDirectory) {
    // List directory contents
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    
    return entries.map(entry => {
      const entryPath = path.join(filePath, entry.name);
      
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: entryPath,
          type: 'dir',
          lastCommit: getLastCommitForPath(repoPath, entryPath)
        };
      } else {
        const stats = fs.statSync(path.join(repoPath, entryPath));
        
        return {
          name: entry.name,
          path: entryPath,
          type: 'file',
          size: stats.size,
          sha: '', // Would normally compute this
          lastCommit: getLastCommitForPath(repoPath, entryPath)
        };
      }
    });
  } else {
    // Return file content info
    const stats = fs.statSync(fullPath);
    
    return {
      name: path.basename(filePath),
      path: filePath,
      type: 'file',
      size: stats.size,
      sha: '', // Would normally compute this
      lastCommit: getLastCommitForPath(repoPath, filePath)
    };
  }
}

/**
 * Gets information about the last commit for a specific path
 * @param {string} repoPath - Path to the repository
 * @param {string} filePath - Path to the file or directory
 * @returns {Object} - Last commit information
 */
function getLastCommitForPath(repoPath, filePath) {
  try {
    // Use mgit log to get last commit for this file or directory
    const output = execSync(`mgit log -1 --format="%h|%an|%at|%s" -- "${filePath}"`, { 
      cwd: repoPath, 
      encoding: 'utf8' 
    });
    
    const [hash, author, timestamp, message] = output.trim().split('|');
    
    return {
      hash,
      message,
      author,
      date: new Date(parseInt(timestamp) * 1000).toISOString()
    };
  } catch (err) {
    console.error(`Error getting last commit for ${filePath}:`, err);
    
    // Return placeholder commit info
    return {
      hash: '',
      message: 'Unknown',
      author: 'Unknown',
      date: new Date().toISOString()
    };
  }
}

/**
 * Gets content of a file
 * @param {string} repoPath - Path to the repository
 * @param {string} filePath - Path to the file
 * @param {string} branch - Branch to checkout before reading
 * @returns {Buffer} - File content
 */
function getFileContent(repoPath, filePath, branch) {
  try {
    // First, ensure we're on the right branch
    execSync(`mgit checkout ${branch}`, { cwd: repoPath });
    
    // Read the file
    const fullPath = path.join(repoPath, filePath);
    return fs.readFileSync(fullPath);
  } catch (err) {
    console.error(`Error getting file content for ${filePath}:`, err);
    throw err;
  }
}

/**
 * Checks if a file is binary based on extension
 * @param {string} extension - File extension
 * @returns {boolean} - True if the file is likely binary
 */
function isBinaryFile(extension) {
  // Common binary file extensions
  const binaryExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.pdf', '.doc', '.docx',
    '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.gz', '.tar', '.bin',
    '.exe', '.dll', '.so', '.o', '.class'
  ];
  
  return binaryExtensions.includes(extension);
}

/**
 * Gets commit history for a branch or file
 * @param {string} repoPath - Path to the repository
 * @param {string} branch - Branch name (optional)
 * @param {string} filePath - Path to the file (optional)
 * @returns {Array<Object>} - Commit history
 */
function getCommitHistory(repoPath, branch, filePath) {
  try {
    // Create the git log command
    let command = 'mgit log --format="%h|%an|%ae|%at|%s"';
    
    if (branch) {
      command += ` ${branch}`;
    }
    
    if (filePath) {
      command += ` -- "${filePath}"`;
    }
    
    // Execute the command
    const output = execSync(command, { cwd: repoPath, encoding: 'utf8' });
    
    // Parse the output
    return output.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const [hash, author, email, timestamp, message] = line.split('|');
        
        // Look for mgit commit mapping if available
        let mgitHash = getMGitHash(repoPath, hash);
        
        return {
          hash: hash,
          mgitHash: mgitHash || null,
          author: {
            name: author,
            email: email
          },
          date: new Date(parseInt(timestamp) * 1000).toISOString(),
          message: message
        };
      });
  } catch (err) {
    console.error('Error getting commit history:', err);
    return [];
  }
}

/**
 * Gets detailed information about a specific commit
 * @param {string} repoPath - Path to the repository
 * @param {string} sha - Commit hash
 * @returns {Object} - Commit details
 */
function getCommitDetail(repoPath, sha) {
  try {
    // Get commit details
    const commitOutput = execSync(`mgit show --no-color --format="%H|%an|%ae|%at|%cn|%ce|%ct|%P|%B" ${sha}`, {
      cwd: repoPath,
      encoding: 'utf8'
    });
    
    const lines = commitOutput.split('\n');
    const headerLine = lines[0];
    const [hash, authorName, authorEmail, authorTimestamp, committerName, committerEmail, commitTimestamp, parents, ...messageParts] = headerLine.split('|');
    
    // The rest of the output is the diff
    const diffStart = commitOutput.indexOf('diff --git');
    const diff = diffStart >= 0 ? commitOutput.substring(diffStart) : '';
    
    // Check for nostr pubkey
    const nostrPubkey = getNostrPubkey(repoPath, hash);
    
    return {
      hash: hash,
      mgitHash: getMGitHash(repoPath, hash) || null,
      author: {
        name: authorName,
        email: authorEmail,
        date: new Date(parseInt(authorTimestamp) * 1000).toISOString(),
        nostrPubkey: nostrPubkey
      },
      committer: {
        name: committerName,
        email: committerEmail,
        date: new Date(parseInt(commitTimestamp) * 1000).toISOString()
      },
      message: messageParts.join('|').trim(),
      parents: parents.split(' ').filter(p => p.length > 0),
      diff: diff
    };
  } catch (err) {
    console.error(`Error getting commit detail for ${sha}:`, err);
    return null;
  }
}

/**
 * Gets the MGit hash corresponding to a Git hash
 * @param {string} repoPath - Path to the repository
 * @param {string} gitHash - Git commit hash
 * @returns {string|null} - MGit hash or null if not found
 */
function getMGitHash(repoPath, gitHash) {
  try {
    // Try to read the nostr_mappings.json file
    const mappingsPath = path.join(repoPath, '.mgit', 'nostr_mappings.json');
    
    if (!fs.existsSync(mappingsPath)) {
      return null;
    }
    
    const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
    
    // Find the mapping for this git hash
    const mapping = mappings.find(m => m.GitHash === gitHash);
    
    return mapping ? mapping.MGitHash : null;
  } catch (err) {
    console.error(`Error getting MGit hash for ${gitHash}:`, err);
    return null;
  }
}

/**
 * Gets the Nostr public key associated with a commit
 * @param {string} repoPath - Path to the repository
 * @param {string} gitHash - Git commit hash
 * @returns {string|null} - Nostr pubkey or null if not found
 */
function getNostrPubkey(repoPath, gitHash) {
  try {
    // Try to read the nostr_mappings.json file
    const mappingsPath = path.join(repoPath, '.mgit', 'nostr_mappings.json');
    
    if (!fs.existsSync(mappingsPath)) {
      return null;
    }
    
    const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
    
    // Find the mapping for this git hash
    const mapping = mappings.find(m => m.GitHash === gitHash);
    
    return mapping ? mapping.Pubkey : null;
  } catch (err) {
    console.error(`Error getting Nostr pubkey for ${gitHash}:`, err);
    return null;
  }
}

module.exports = {
  getDefaultBranch,
  getBranches,
  getRepoDescription,
  getLastCommitDate,
  getRepoCreationDate,
  getLicense,
  getRepoContents,
  getLastCommitForPath,
  getFileContent,
  isBinaryFile,
  getCommitHistory,
  getCommitDetail,
  getMGitHash,
  getNostrPubkey
};