package directory_client

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
)

var _ DirectoryClient = &OsDirectoryClient{} // make sure the OsDirectoryClient implements the DirectoryClient

type OsDirectoryClient struct {
}

func (c *OsDirectoryClient) Create(path string, permissions string) (string, error) {
	created, err := makePath(path, permissions)
	if len(created) > 0 {
		fmt.Printf("created: %#v", created)
		return created[0], err
	} else {
		return "", err
	}
}

func (c *OsDirectoryClient) Read(path string) (string, map[string]map[string]string, error) {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil, err
		}
		return "", nil, err
	}
	mode := fmt.Sprintf("%#o", info.Mode().Perm())

	data, err := os.ReadDir(path)
	if err != nil {
		return "", nil, err
	}
	files := make(map[string]map[string]string)
	for _, file := range data {
		var isDir string
		fileInfo, err := file.Info()
		if err != nil {
			return "", nil, err
		}
		if fileInfo.IsDir() {
			isDir = "true"
		} else {
			isDir = "false"
		}
		files[file.Name()] = map[string]string{
			"Size":    strconv.FormatInt(fileInfo.Size(), 10),
			"Mode":    fmt.Sprintf("%#o", fileInfo.Mode().Perm()),
			"ModTime": fileInfo.ModTime().String(),
			"IsDir":   isDir,
		}
	}
	return mode, files, nil
}

// The only thing that can be updated is the permissions.
func (c *OsDirectoryClient) Update(path string, permissions string) error {
	modeInt, err := strconv.ParseUint(permissions, 8, 32)
	if err != nil {
		return err
	}
	err = os.Chmod(path, os.FileMode(modeInt))
	if err != nil {
		return err
	}
	return nil
}

func (c *OsDirectoryClient) Delete(path string) error {
	if path == "" {
		return nil
	}
	return os.RemoveAll(path)
}

func makePath(path string, permissions string) ([]string, error) {
	var created []string
	info, err := os.Stat(path)
	if err == nil {
		if info.IsDir() {
			return created, nil // Path already exists and is a directory.
		}
		// Path exists but is a file, which is an error.
		return nil, fmt.Errorf("path '%s' exists and is not a directory", path)
	}
	if !os.IsNotExist(err) {
		// There was an error, but not that the directory doesn't exist, something is up with the file system.
		return nil, err
	}
	// From here we know the filesystem is ready and the path doesn't exist.

	parent := filepath.Dir(path)

	if path == parent {
		// If we have reached a path with no parent then return the empty list.
		// This breaks the recursion.
		return created, nil
	}

	// Start a recursion.
	// This will recurse until path = parent, where parentCreated will be the empty list.
	parentCreated, err := makePath(parent, permissions)
	if err != nil {
		return nil, err
	}
	// Add the parent's created directories to our list.
	created = append(created, parentCreated...)

	// The first time this point is reached we know:
	//  - "created" is an empty list.
	//  - the parent directory exists and is a valid directory.
	//  - the filesystem is ready and the current path doesn't exist.
	// This means we are good to create the current path and return it.
	// Any other time we know:
	//  - the parent directory exists and is a valid directory.
	//  - the filesystem is ready and the current path doesn't exist.
	//  - there was no error in the previous recursion.
	// This means the previous recursion must have successfully generated a directory.
	// In any recursion cycle from this point the parent directory exists and is valid.

	modeInt, err := strconv.ParseUint(permissions, 8, 32)
	if err != nil {
		return nil, err
	}
	if err := os.Mkdir(path, os.FileMode(modeInt)); err != nil {
		return nil, err
	} else {
		// We successfully created the directory, add it to our list.
		created = append(created, path)
	}

	return created, nil
}

// Added to help with testing, use the file client to create files in production.
func (c *OsDirectoryClient) CreateFile(path string, data string, permissions string, lastModified string) error {
	modeInt, err := strconv.ParseUint(permissions, 8, 32)
	if err != nil {
		return err
	}
	return os.WriteFile(path, []byte(data), os.FileMode(modeInt))
}
